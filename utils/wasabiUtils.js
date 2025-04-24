const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs-extra');

// Configuração do Wasabi
const wasabiConfig = {
  accessKeyId: process.env.WASABI_ACCESS_KEY_ID,
  secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY,
  endpoint: process.env.WASABI_ENDPOINT || 's3.wasabisys.com',
  s3ForcePathStyle: true,
  signatureVersion: 'v4',
};

const s3 = new AWS.S3(wasabiConfig);

const BUCKET_NAME = process.env.WASABI_BUCKET_NAME || 'video-generation';

// Função para fazer upload de um arquivo para o Wasabi
const uploadToWasabi = async (filePath, key) => {
  try {
    const fileContent = fs.readFileSync(filePath);
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileContent,
      ContentType: 'video/mp4',
      ACL: 'private'
    };

    const data = await s3.upload(params).promise();
    console.log(`Arquivo enviado para o Wasabi: ${key}`);
    return data.Location;
  } catch (error) {
    console.error('Erro ao fazer upload para o Wasabi:', error.message);
    throw error;
  }
};

// Função para gerar uma URL assinada para acesso temporário ao arquivo
const getSignedUrl = async (key, expiresIn = 3600) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Expires: expiresIn
    };

    const url = await s3.getSignedUrlPromise('getObject', params);
    console.log(`URL assinada gerada para: ${key}`);
    return url;
  } catch (error) {
    console.error('Erro ao gerar URL assinada:', error.message);
    throw error;
  }
};

module.exports = {
  uploadToWasabi,
  getSignedUrl
};
