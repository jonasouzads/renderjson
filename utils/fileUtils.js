const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

// Diretórios temporários e de saída
const TEMP_DIR = path.join(__dirname, '..', 'temp');
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

// Função para extrair ID de URL do Google Drive e formatar para download direto
const extractGoogleDriveId = (url) => {
  const match = url.match(/id=([^&]+)/);
  return match ? match[1] : null;
};

const formatGoogleDriveUrl = (id) => {
  return `https://drive.google.com/uc?export=download&id=${id}`;
};

// Função para baixar arquivos com tratamento especial para Google Drive
const downloadFile = async (url, outputPath, description = 'arquivo') => {
  let downloadUrl = url;
  const googleDriveId = extractGoogleDriveId(url);
  if (googleDriveId) {
    downloadUrl = formatGoogleDriveUrl(googleDriveId);
    console.log(`URL de download do Google Drive formatada: ${downloadUrl}`);
  }

  try {
    console.log(`Baixando ${description} de ${url}`);
    const response = await axios({
      url: downloadUrl,
      method: 'GET',
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error) {
    console.error(`Erro ao baixar ${description}:`, error.message);
    throw error;
  }
};

module.exports = {
  TEMP_DIR,
  OUTPUT_DIR,
  downloadFile,
  ensureDirectoriesExist: async () => {
    await fs.ensureDir(TEMP_DIR);
    await fs.ensureDir(OUTPUT_DIR);
    // Removido fs.emptyDir(TEMP_DIR) para evitar exclusão de arquivos necessários
  }
};
