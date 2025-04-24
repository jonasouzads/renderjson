const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs'); 
const { TEMP_DIR, OUTPUT_DIR } = require('./fileUtils');

// Função para obter duração do áudio
const getAudioDuration = (audioPath, index) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        console.error(`Erro ao obter duração do áudio ${index}:`, err);
        reject(err);
      } else {
        const duration = metadata.format.duration;
        console.log(`Duração do áudio ${index}: ${duration} segundos`);
        resolve(duration);
      }
    });
  });
};

/**
 * Cria um clipe de vídeo a partir de uma imagem e um arquivo de áudio.
 * @param {string} imagePath - Caminho para o arquivo de imagem
 * @param {string} audioPath - Caminho para o arquivo de áudio
 * @param {string} outputPath - Caminho para o arquivo de saída
 * @param {string} subtitlePath - Caminho para o arquivo de legendas (opcional)
 * @param {string} orientation - Orientação do vídeo ('landscape' ou 'portrait')
 * @returns {Promise<string>} - Caminho para o arquivo de saída
 */
const createImageClip = async (imagePath, audioPath, outputPath, subtitlePath, orientation = 'landscape') => {
  return new Promise(async (resolve, reject) => {
    if (!fs.existsSync(imagePath)) {
      return reject(new Error(`Arquivo de imagem não encontrado: ${imagePath}`));
    }

    if (!fs.existsSync(audioPath)) {
      return reject(new Error(`Arquivo de áudio não encontrado: ${audioPath}`));
    }

    console.log(`Criando clipe de imagem: ${imagePath}`);
    console.log(`Incluindo áudio no clipe: ${audioPath}`);
    
    // Obter duração do áudio
    let duration;
    try {
      duration = await getAudioDuration(audioPath);
    } catch (err) {
      return reject(new Error(`Erro ao obter duração do áudio: ${err.message}`));
    }
    
    // Configurar dimensões com base na orientação
    const videoWidth = orientation === 'portrait' ? 720 : 1280;
    const videoHeight = orientation === 'portrait' ? 1280 : 720;
    
    // Criar diretório temporário para arquivos de trabalho
    const tempDir = path.join(TEMP_DIR, 'temp_work');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Primeiro, criar um vídeo base sem legendas
    const baseVideoPath = path.join(tempDir, `base_${path.basename(outputPath)}`);
    
    // Comando para criar o vídeo base
    const ffmpegCommand = `ffmpeg -loop 1 -t ${duration} -i "${imagePath}" -i "${audioPath}" -y -c:v libx264 -c:a aac -b:a 192k -pix_fmt yuv420p -shortest -movflags +faststart "${baseVideoPath}"`;
    console.log(`Comando FFmpeg base iniciado: ${ffmpegCommand}`);
    
    // Executar o comando FFmpeg diretamente
    const { exec } = require('child_process');
    exec(ffmpegCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`Erro ao criar vídeo base: ${error.message}`);
        return reject(error);
      }
      
      console.log(`Vídeo base criado com sucesso: ${baseVideoPath}`);
      
      // Se não houver legendas, apenas renomear o arquivo base
      if (!subtitlePath || !fs.existsSync(subtitlePath)) {
        fs.renameSync(baseVideoPath, outputPath);
        console.log(`Clipe de imagem finalizado (sem legendas): ${outputPath}`);
        resolve(outputPath);
        return;
      }
      
      // Segundo passo: adicionar legendas ao vídeo base
      console.log(`Aplicando legendas ao vídeo base: ${subtitlePath}`);
      
      try {
        // Criar uma cópia do arquivo de legendas com um nome simples em um diretório sem espaços
        const simpleDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(simpleDir)) {
          fs.mkdirSync(simpleDir, { recursive: true });
        }
        
        const simpleSubtitlePath = path.join(simpleDir, `sub${Date.now()}.ass`);
        fs.copyFileSync(subtitlePath, simpleSubtitlePath);
        console.log(`Arquivo de legendas copiado para: ${simpleSubtitlePath}`);
        
        // Mudar para o diretório onde está o arquivo de legendas
        const currentDir = process.cwd();
        process.chdir(simpleDir);
        
        // Usar apenas o nome do arquivo, sem caminho
        const subtitleFileName = path.basename(simpleSubtitlePath);
        
        // Comando para adicionar legendas usando caminho relativo
        const subtitleCommand = `ffmpeg -i "${baseVideoPath}" -vf "subtitles=${subtitleFileName}" -y -c:v libx264 -c:a copy -pix_fmt yuv420p "${outputPath}"`;
        console.log(`Comando FFmpeg para legendas iniciado: ${subtitleCommand}`);
        
        // Executar o comando FFmpeg diretamente
        exec(subtitleCommand, (error, stdout, stderr) => {
          // Voltar para o diretório original
          process.chdir(currentDir);
          
          if (error) {
            console.error(`Erro ao adicionar legendas: ${error.message}`);
            
            // Em caso de erro, usar o vídeo base
            console.log(`Usando vídeo base como fallback: ${baseVideoPath}`);
            fs.renameSync(baseVideoPath, outputPath);
            resolve(outputPath);
            return;
          }
          
          console.log(`Clipe de imagem finalizado (com legendas): ${outputPath}`);
          
          // Limpar arquivos temporários
          try {
            fs.unlinkSync(baseVideoPath);
            fs.unlinkSync(simpleSubtitlePath);
          } catch (cleanupErr) {
            console.warn(`Erro ao limpar arquivos temporários: ${cleanupErr.message}`);
          }
          
          resolve(outputPath);
        });
      } catch (error) {
        console.error(`Erro ao preparar legendas: ${error.message}`);
        
        // Em caso de erro, usar o vídeo base
        console.log(`Usando vídeo base como fallback: ${baseVideoPath}`);
        fs.renameSync(baseVideoPath, outputPath);
        resolve(outputPath);
      }
    });
  });
};

// Função para concatenar vídeos com transições
const concatenateVideos = (videoPaths, outputPath, durations, backgroundAudioPath = null, backgroundVolume = 0.1) => {
  return new Promise((resolve, reject) => {
    if (!videoPaths || videoPaths.length === 0) {
      return reject(new Error('Nenhum vídeo fornecido para concatenação'));
    }

    console.log('Concatenando vídeos...');
    console.log(`Número de vídeos a concatenar: ${videoPaths.length}`);
    
    // Verificar se todos os vídeos existem
    const missingVideos = videoPaths.filter(path => !fs.existsSync(path));
    if (missingVideos.length > 0) {
      return reject(new Error(`Alguns vídeos não foram encontrados: ${missingVideos.join(', ')}`));
    }

    // Se houver apenas um vídeo, apenas copiar para o destino
    if (videoPaths.length === 1) {
      console.log('Apenas um vídeo, copiando para o destino...');
      fs.copyFile(videoPaths[0], outputPath, (err) => {
        if (err) {
          console.error('Erro ao copiar vídeo único:', err);
          return reject(err);
        }
        console.log(`Vídeo copiado com sucesso para: ${outputPath}`);
        resolve(outputPath);
      });
      return;
    }

    let filterComplex = '';
    for (let i = 0; i < videoPaths.length; i++) {
      if (i > 0) {
        filterComplex += `[${i}:v]fade=t=in:st=0:d=0.5[v${i}fi];`;
      }
      filterComplex += `[v${i}${i > 0 ? 'fi' : ''}]fade=t=out:st=${durations[i] - 0.5}:d=0.5[v${i}fo];`;
    }
    filterComplex += videoPaths.map((_, i) => `[v${i}fo][${i}:a]`).join('') + `concat=n=${videoPaths.length}:v=1:a=1[outv][outa]`;
    console.log('Filtro de concatenação com transições:', filterComplex);

    const command = ffmpeg();
    videoPaths.forEach(path => command.input(path));
    
    // Adicionar áudio de fundo se fornecido
    if (backgroundAudioPath && fs.existsSync(backgroundAudioPath)) {
      command.input(backgroundAudioPath);
      // Ajustar o filtro complexo para mixar o áudio de fundo
      filterComplex = filterComplex.replace('[outv][outa]', `[outv][outa][${videoPaths.length}:a]amix=inputs=2:duration=longest:weights=${1-backgroundVolume} ${backgroundVolume}[finala]`);
      command.outputOptions([
        '-map [outv]',
        '-map [finala]',
      ]);
    } else {
      command.outputOptions([
        '-map [outv]',
        '-map [outa]',
      ]);
    }
    
    command
      .complexFilter(filterComplex)
      .outputOptions([
        '-c:v libx264',
        '-c:a aac',
        '-b:a 192k',
        '-pix_fmt yuv420p'
      ])
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log(`Comando FFmpeg para concatenação: ${commandLine}`);
      })
      .on('end', () => {
        console.log(`Vídeos concatenados com sucesso em: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('Erro ao concatenar vídeos:', err);
        reject(err);
      })
      .run();
  });
};

module.exports = {
  getAudioDuration,
  createImageClip,
  concatenateVideos
};
