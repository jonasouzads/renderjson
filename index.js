const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const helmet = require('helmet');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Carrega variáveis de ambiente
dotenv.config();

// Inicializa o Express
const app = express();
app.set('trust proxy', 1); // Confiar no primeiro proxy
app.use(express.json({ limit: '10mb' }));

// Adicionar cabeçalhos de segurança com helmet
app.use(helmet());

// Configurar limitação de taxa
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // limite de 100 requisições por IP
});
app.use(limiter);

// Configurações
const PORT = process.env.PORT || 3000;
const TEMP_DIR = path.join(__dirname, 'temp');
const OUTPUT_DIR = path.join(__dirname, 'output');

// Importações de utilitários
const { downloadFile, ensureDirectoriesExist } = require('./utils/fileUtils');
const { concatenateVideos } = require('./utils/videoConcatenation');
const { saveProcessStatus, saveVideoInfo, updateVideoInfo } = require('./utils/supabaseUtils');
const { validateUserToken, checkUserCredits, deductUserCredits } = require('./utils/authUtils');
const { createASSFile, createASSFileFromTranscription, subtitleStyles } = require('./utils/subtitleUtils');
const { uploadToWasabi, getSignedUrl } = require('./utils/wasabiUtils');
const { createClient } = require('@supabase/supabase-js');
const { transcribeAudioWithAssemblyAI } = require('./utils/transcriptionUtils');
const { createImageClip, getAudioDuration } = require('./utils/videoUtils');

// Conecta ao Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Garantir que os diretórios existam antes de iniciar o servidor
ensureDirectoriesExist().then(() => {
  console.log('Diretórios temporários e de saída garantidos.');
});

// Função para limitar concorrência
const limitConcurrency = async (tasks, limit) => {
  const results = [];
  const executing = new Set();

  for (const task of tasks) {
    const p = task();
    results.push(p);
    executing.add(p);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
    executing.delete(p);
  }

  return Promise.all(results);
};

// Adicionar um objeto para armazenar transcrições já realizadas
const transcriptionCache = {};

// Middleware para verificar o token do usuário
const verifyToken = async (req, res, next) => {
  try {
    // Validar token de autenticação
    const authResult = await validateUserToken(req.headers.authorization);
    if (authResult.error) {
      return res.status(authResult.status).json({ error: authResult.error });
    }
    req.user = authResult.user;
    next();
  } catch (error) {
    console.error('Erro ao verificar token:', error.message);
    res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
};

// Função para verificar e descontar créditos do usuário
const checkAndDeductCredits = async (userId, amount = 1) => {
  try {
    // Verificar créditos do usuário
    const creditsResult = await checkUserCredits(userId, amount);
    if (creditsResult.error) {
      throw new Error(creditsResult.error);
    }

    // Descontar créditos do usuário
    const deductResult = await deductUserCredits(userId, amount);
    if (deductResult.error) {
      throw new Error(deductResult.error);
    }

    console.log(`Créditos descontados para usuário ${userId}: ${amount}`);
    return true;
  } catch (error) {
    throw new Error(error.message);
  }
};

// Endpoint para consultar o status de um processamento
app.get('/status/:processId', async (req, res) => {
  const { processId } = req.params;
  const statusData = await loadProcessStatus();

  if (statusData[processId]) {
    res.json({
      success: true,
      processId: processId,
      status: statusData[processId].status,
      updatedAt: statusData[processId].updatedAt,
      details: statusData[processId].details
    });
  } else {
    res.status(404).json({
      success: false,
      message: 'Processo não encontrado.'
    });
  }
});

// Schema de validação para o endpoint /generate-video
const videoGenerationSchema = Joi.object({
  scenes: Joi.array().items(
    Joi.object({
      scene_number: Joi.number().required(),
      text: Joi.string().optional(),
      narrative_text: Joi.string().optional(), // Campo narrative_text adicionado
      audio_url: Joi.string().uri().optional(),
      image_url: Joi.string().uri().optional(),
      webhook_url: Joi.string().uri().optional(),
      duration: Joi.number().optional(),
      subtitleStyle: Joi.string().optional(),
      subtitle_options: Joi.object().optional().allow(null)
    })
  ).min(1).required(),
  bg_audio_url: Joi.string().uri().optional(),
  background_volume: Joi.number().min(0).max(1).default(0.1),
  orientation: Joi.string().valid('landscape', 'portrait').default('landscape'),
  subtitle_style: Joi.string().optional(),
  subtitle_position: Joi.string().optional(),
  subtitle_options: Joi.object({
    styleName: Joi.string().optional(),
    fontSize: Joi.number().optional(),
    color: Joi.string().optional(),
    backgroundColor: Joi.string().optional()
  }).optional().allow(null),
  webhook_url: Joi.string().uri().optional().allow('')
});

// Endpoint para gerar vídeo a partir de um JSON com cenas
// Removido temporariamente o middleware verifyToken para testes
app.post('/generate-video', async (req, res) => {
  try {
    console.log('Requisição recebida para /generate-video');

    // Validar entrada
    const { error, value } = videoGenerationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: 'Dados de entrada inválidos.', details: error.details });
    }

    // Extrair dados da requisição
    const { scenes = [], bg_audio_url, background_volume = 0.1, orientation = 'landscape', subtitle_style, subtitle_position, webhook_url } = value;

    // Validar token de autenticação
    const authResult = await validateUserToken(req.headers.authorization);
    if (authResult.error) {
      return res.status(authResult.status).json({ error: authResult.error });
    }
    req.user = authResult.user;

    // Verificar créditos do usuário
    const creditsResult = await checkUserCredits(req.user.id, 1);
    if (creditsResult.error) {
      return res.status(creditsResult.status).json({ error: creditsResult.error });
    }

    // Gerar um ID único para o processamento
    const processId = `proc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    console.log(`Gerado ID de processamento: ${processId}`);

    // Retornar resposta imediata ao cliente
    res.status(202).json({
      success: true,
      message: 'Requisição aceita para processamento.',
      processId: processId,
      status: 'queued'
    });

    // Salvar status inicial no Supabase
    await saveProcessStatus(processId, 'queued', { scenesCount: scenes.length, user_id: req.user?.id || 'anonymous' });

    // Processar em background
    setImmediate(async () => {
      try {
        // Atualizar status para 'processing'
        await saveProcessStatus(processId, 'processing', { scenesCount: scenes.length, user_id: req.user?.id || 'anonymous' });

        // Garantir que os diretórios existam
        ensureDirectoriesExist();

        // Processar cenas
        const videoPaths = [];
        const durations = [];

        // Todas as cenas serão processadas, sem filtrar duplicatas
        const uniqueScenes = scenes;

        console.log(`Total de cenas a processar: ${uniqueScenes.length}`);

        // Baixar áudio de fundo se fornecido
        let backgroundAudioPath = '';
        if (bg_audio_url) {
          backgroundAudioPath = path.join(TEMP_DIR, 'background_audio.mp3');
          try {
            await downloadFile(bg_audio_url, backgroundAudioPath, 'áudio de fundo');
          } catch (downloadErr) {
            console.error(`Erro ao baixar áudio de fundo:`, downloadErr);
            await saveProcessStatus(processId, 'failed', { error: `Erro ao baixar áudio de fundo: ${downloadErr.message}`, user_id: req.user?.id || 'anonymous' });
            return;
          }
        }

        // Implementar processamento paralelo de cenas com limite de concorrência
        const downloadTasks = uniqueScenes.map((scene, i) => async () => {
          console.log(`Processando cena ${i + 1} (Número da cena: ${scene.scene_number})...`);

          // Baixar áudio
          if (scene.audio_url) {
            if (scene.audio_url.includes('drive.google.com')) {
              // Extrair o ID do arquivo do Google Drive
              const fileIdMatch = scene.audio_url.match(/file\/d\/([a-zA-Z0-9_-]+)|id=([a-zA-Z0-9_-]+)/);
              const fileId = fileIdMatch ? (fileIdMatch[1] || fileIdMatch[2]) : null;
              if (fileId) {
                scene.audio_url = `https://drive.google.com/uc?export=download&id=${fileId}`;
                console.log(`URL do Google Drive ajustada para cena ${i + 1}: ${scene.audio_url}`);
              }
            }

            console.log(`Baixando áudio para cena ${i + 1} de ${scene.audio_url}`);
            const audioPath = path.join(TEMP_DIR, `audio_${i}.mp3`);
            await downloadFile(scene.audio_url, audioPath);
          }

          // Baixar imagem
          if (scene.image_url) {
            console.log(`Baixando imagem para cena ${i + 1} de ${scene.image_url}`);
            const imagePath = path.join(TEMP_DIR, `image_${i}.jpg`);
            await downloadFile(scene.image_url, imagePath);
          }
        });

        try {
          await limitConcurrency(downloadTasks, 5);
        } catch (err) {
          console.error(`Erro ao baixar arquivos:`, err);
          await saveProcessStatus(processId, 'failed', { error: `Erro ao baixar arquivos para as cenas: ${err.message}`, user_id: req.user?.id || 'anonymous' });
          return;
        }

        // Obter opções de legendas globais (se existirem)
        const globalSubtitleOptions = req.body.subtitle_options || {};

        // Depois, processar cada cena em paralelo com limite de 3 tarefas simultâneas (processamento de vídeo é mais pesado)
        const processingTasks = uniqueScenes.map((scene, i) => async () => {
          console.log(`Processando cena ${i + 1} (Número da cena: ${scene.scene_number})...`);

          // Verificar se os arquivos existem
          const audioPath = path.join(TEMP_DIR, `audio_${i}.mp3`);
          const imagePath = path.join(TEMP_DIR, `image_${i}.jpg`);

          if (!fs.existsSync(audioPath)) {
            throw new Error(`Arquivo de áudio não encontrado para cena ${i + 1}.`);
          }

          if (!fs.existsSync(imagePath)) {
            throw new Error(`Arquivo de imagem não encontrado para cena ${i + 1}.`);
          }

          // Obter duração do áudio
          let duration;
          try {
            duration = await getAudioDuration(audioPath, i);
            durations[i] = duration; // Garantir que a duração está na posição correta
          } catch (durationErr) {
            console.error(`Erro ao obter duração do áudio ${i + 1}: ${durationErr.message}`);
            throw new Error(`Erro ao processar áudio para cena ${i + 1}: não foi possível determinar a duração. ${durationErr.message}`);
          }

          // Transcrever áudio se disponível - usando cache para evitar transcrições repetidas
          let subtitlePath = null;
          const audioKey = scene.audio_url || scene.audio; // Usar URL ou conteúdo como chave
          
          const assemblyAiApiKey = process.env.ASSEMBLYAI_API_KEY;
          if (assemblyAiApiKey && audioKey) {
            let transcription;
            
            if (transcriptionCache[audioKey]) {
              console.log(`Usando transcrição em cache para cena ${i + 1}`);
              transcription = transcriptionCache[audioKey];
            } else {
              console.log(`Transcrevendo áudio para cena ${i + 1}...`);
              try {
                const transcriptionResult = await transcribeAudioWithAssemblyAI(audioPath);
                if (transcriptionResult && transcriptionResult.text) {
                  transcription = transcriptionResult;
                  transcriptionCache[audioKey] = transcription; // Armazenar em cache para uso futuro
                  console.log(`Transcrição concluída para cena ${i + 1}`);
                } else {
                  console.warn(`Transcrição vazia ou inválida para cena ${i + 1}`);
                }
              } catch (transcriptionError) {
                console.error(`Erro ao transcrever áudio para cena ${i + 1}:`, transcriptionError);
                // Continuar sem legendas se a transcrição falhar
              }
            }
            
            // Se temos uma transcrição, criar um arquivo ASS para esta cena específica
            if (transcription) {
              // Combinar opções de legendas globais com opções específicas da cena
              const subtitleOptions = {
                ...globalSubtitleOptions,
                ...(scene.subtitle_options || {}),
                styleName: subtitle_style,
                position: subtitle_position || 'bottom'
              };
              
              console.log(`Aplicando estilo de legenda para cena ${i + 1}:`, subtitle_style || 'default');
              console.log(`Aplicando posição de legenda para cena ${i + 1}:`, subtitle_position || 'bottom');
              
              subtitlePath = path.join(TEMP_DIR, `subtitle_temp_${Date.now()}_${i}.ass`);
              await createASSFileFromTranscription(transcription, subtitlePath, duration, subtitleOptions);
            }
          }

          // Criar clipe de imagem com áudio e legendas
          const outputPath = path.join(TEMP_DIR, `scene_${i}.mp4`);
          await createImageClip(imagePath, audioPath, outputPath, subtitlePath, scene.orientation || orientation);
          videoPaths[i] = outputPath; // Garantir que o caminho do vídeo está na posição correta
        });

        try {
          await limitConcurrency(processingTasks, 3);
        } catch (sceneErr) {
          console.error(`Erro ao processar cena ${sceneErr.scene_number}:`, sceneErr);
          await saveProcessStatus(processId, 'failed', { error: `Erro na cena ${sceneErr.scene_number}: ${sceneErr.message}`, user_id: req.user?.id || 'anonymous' });
          return;
        }

        // Concatenar vídeos
        const finalOutputPath = path.join(OUTPUT_DIR, `output_video_${Date.now()}.mp4`);
        try {
          console.log('Concatenando vídeos...');
          await concatenateVideos(videoPaths, finalOutputPath, durations, backgroundAudioPath, background_volume);
          console.log(`Vídeos concatenados com sucesso em ${finalOutputPath}`);
        } catch (concatError) {
          console.error('Erro ao concatenar vídeos, tentando concatenação simples:', concatError);
          // Tentar concatenação simples sem transições e sem áudio de fundo
          try {
            await concatenateVideos(videoPaths, finalOutputPath, durations);
            console.log(`Concatenação simples realizada em ${finalOutputPath}`);
          } catch (simpleConcatError) {
            console.error('Erro na concatenação simples:', simpleConcatError);
            await saveProcessStatus(processId, 'failed', { error: `Erro na concatenação simples: ${simpleConcatError.message}`, user_id: req.user?.id || 'anonymous' });
            return;
          }
        }

        // Salvar informações do vídeo no Supabase
        const videoInfo = {
          process_id: processId,
          output_path: finalOutputPath,
          orientation: orientation || 'portrait',
          scenes_count: scenes.length
        };
        try {
          console.log('Salvando informações do vídeo no Supabase:', videoInfo);
          const saveResult = await saveVideoInfo(videoInfo);
          console.log('Resultado do salvamento no Supabase:', saveResult);
        } catch (saveError) {
          console.error('Erro ao salvar informações do vídeo no Supabase:', saveError.message);
        }

        // Fazer upload do vídeo para o Wasabi
        const wasabiKey = `videos/${processId}/${path.basename(finalOutputPath)}`;
        let videoUrl;
        try {
          videoUrl = await uploadToWasabi(finalOutputPath, wasabiKey);
          console.log('Upload para Wasabi concluído:', videoUrl);
        } catch (uploadErr) {
          console.error('Erro ao fazer upload do vídeo para o Wasabi:', uploadErr.message);
          await saveProcessStatus(processId, 'failed', { error: `Erro ao fazer upload do vídeo: ${uploadErr.message}`, user_id: req.user?.id || 'anonymous' });
          return;
        }

        // Atualizar informações do vídeo no Supabase
        try {
          console.log('Atualizando informações do vídeo no Supabase com URL:', videoUrl);
          const updateResult = await updateVideoInfo(processId, { video_url: videoUrl });
          console.log('Resultado da atualização no Supabase:', updateResult);
        } catch (updateError) {
          console.error('Erro ao atualizar informações do vídeo no Supabase:', updateError.message);
        }

        // Verifica se há um webhook_url para callback (usa o primeiro disponível)
        if (webhook_url) {
          try {
            await axios.post(webhook_url, { video_url: videoUrl });
            console.log('Callback enviado para webhook_url');
          } catch (error) {
            console.error('Erro ao enviar callback para webhook_url:', error.message);
          }
        }

        // Atualizar status para 'completed' após o processamento
        await saveProcessStatus(processId, 'completed', { 
          scenesProcessed: scenes.length,
          outputPath: finalOutputPath,
          videoUrl: videoUrl,
          user_id: req.user?.id || 'anonymous'
        });

        console.log(`Vídeo final gerado em: ${finalOutputPath}`);
      } catch (error) {
        console.error(`Erro no processamento em background para ${processId}:`, error);
        await saveProcessStatus(processId, 'failed', { error: error.message, user_id: req.user?.id || 'anonymous' });
      }
    });
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor.', error: error.message });
  }
});

// Endpoint para obter URL assinada para vídeo
app.get('/video-url/:processId', verifyToken, async (req, res) => {
  const { processId } = req.params;
  const statusData = await loadProcessStatus();

  if (!statusData[processId] || statusData[processId].status !== 'completed') {
    return res.status(404).json({ success: false, message: 'Vídeo não encontrado ou não está pronto.' });
  }

  if (statusData[processId].details.user_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Acesso negado ao vídeo.' });
  }

  const wasabiKey = `videos/${processId}/${path.basename(statusData[processId].details.outputPath)}`;
  try {
    // Validar token de autenticação
    const authResult = await validateUserToken(req.headers.authorization);
    if (authResult.error) {
      return res.status(authResult.status).json({ success: false, message: authResult.error });
    }
    req.user = authResult.user;

    const signedUrl = await getSignedUrl(wasabiKey);
    res.json({ success: true, url: signedUrl });
  } catch (error) {
    console.error('Erro ao gerar URL assinada:', error.message);
    res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
