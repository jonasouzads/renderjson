const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { TEMP_DIR } = require('./fileUtils');

// Chave da API AssemblyAI
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

// Função para transcrever áudio usando AssemblyAI
const transcribeAudioWithAssemblyAI = async (audioPath) => {
  if (!ASSEMBLYAI_API_KEY) {
    throw new Error('Chave da API AssemblyAI não configurada.');
  }

  try {
    // Faz upload do arquivo de áudio para a AssemblyAI
    const audioData = await fs.readFile(audioPath);
    const uploadResponse = await axios.post('https://api.assemblyai.com/v2/upload', audioData, {
      headers: {
        'authorization': ASSEMBLYAI_API_KEY,
        'content-type': 'application/octet-stream'
      }
    });

    const audioUrl = uploadResponse.data.upload_url;

    // Solicita transcrição com timestamps no nível de palavra
    const transcriptionResponse = await axios.post('https://api.assemblyai.com/v2/transcript', {
      audio_url: audioUrl,
      language_code: 'pt',
      punctuate: true,
      format_text: true,
      disfluencies: false
    }, {
      headers: {
        'authorization': ASSEMBLYAI_API_KEY,
        'content-type': 'application/json'
      }
    });

    const transcriptId = transcriptionResponse.data.id;

    // Aguarda a conclusão da transcrição
    let transcriptStatus = 'processing';
    let transcriptionResult = null;
    while (transcriptStatus === 'processing' || transcriptStatus === 'queued') {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Aguarda 2 segundos
      const statusResponse = await axios.get(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: {
          'authorization': ASSEMBLYAI_API_KEY
        }
      });
      transcriptStatus = statusResponse.data.status;
      if (transcriptStatus === 'completed') {
        transcriptionResult = statusResponse.data;
        break;
      } else if (transcriptStatus === 'failed') {
        throw new Error(`Transcrição falhou: ${statusResponse.data.error}`);
      }
    }

    if (!transcriptionResult) {
      throw new Error('Timeout ao aguardar transcrição.');
    }

    return transcriptionResult;
  } catch (error) {
    console.error('Erro na transcrição com AssemblyAI:', error.message);
    throw error;
  }
};

module.exports = {
  transcribeAudioWithAssemblyAI
};
