const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Concatena uma lista de vídeos com transições e áudio de fundo opcional.
 * @param {Array<string>} videoPaths - Caminhos dos vídeos a serem concatenados.
 * @param {string} outputPath - Caminho do arquivo de saída.
 * @param {string} backgroundMusicPath - Caminho do áudio de fundo (opcional).
 * @returns {Promise<string>}
 */
async function concatenateVideos(videoPaths, outputPath, backgroundMusicPath = null) {
    if (!videoPaths || videoPaths.length === 0) {
        throw new Error('Nenhum vídeo para concatenar.');
    }

    // Garantir que o diretório temporário exista
    const tempDir = path.dirname('temp/temp_work/concat_list.txt');
    fs.mkdirSync(tempDir, { recursive: true });

    // Usar caminhos absolutos para evitar problemas de diretório
    const absoluteOutputPath = path.resolve(outputPath);
    const concatListPath = path.resolve('temp/temp_work/concat_list.txt');

    // Cria um arquivo de lista temporário para os vídeos
    const listContent = videoPaths.map(p => `file '${path.resolve(p).replace(/\\/g, '/')}''`).join('\n');
    fs.writeFileSync(concatListPath, listContent);

    try {
        // Monta o comando ffmpeg para concatenação
        let ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${concatListPath}" -c:v copy -c:a aac -b:a 192k -y "${absoluteOutputPath}"`;

        // Se houver música de fundo, verifica se o arquivo existe antes de adicionar ao comando
        if (backgroundMusicPath && fs.existsSync(backgroundMusicPath)) {
            const bgMusicPath = path.resolve(backgroundMusicPath);
            ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${concatListPath}" -i "${bgMusicPath}" -filter_complex "[1:a]volume=0.2[bg];[0:a][bg]amix=inputs=2:duration=longest[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -y "${absoluteOutputPath}"`;
        } else if (backgroundMusicPath) {
            console.log(`Arquivo de música de fundo não encontrado: ${backgroundMusicPath}. Concatenando sem música de fundo.`);
        }

        console.log(`Executando comando de concatenação: ${ffmpegCommand}`);
        await execPromise(ffmpegCommand);
        console.log(`Concatenação concluída: ${absoluteOutputPath}`);
        fs.unlinkSync(concatListPath);
        return absoluteOutputPath;
    } catch (err) {
        console.error(`Erro durante a concatenação:`, err);
        if (fs.existsSync(concatListPath)) {
            fs.unlinkSync(concatListPath);
        }
        throw err;
    }
}

module.exports = { concatenateVideos };
