# Video Generator Server

Este projeto é uma API de servidor Node.js para gerar vídeos a partir de cenas contendo áudio, imagens e legendas. Ele suporta transcrição automática de áudio para legendas sincronizadas, legendas estilizadas no formato ASS com destaque de palavras estilo CapCut, e integração com Supabase e Wasabi para armazenamento.

## Funcionalidades

- **Geração de Vídeo**: Cria vídeos a partir de imagens e áudio fornecidos para cada cena.
- **Transcrição de Áudio**: Transcreve áudio e cria legendas sincronizadas com as falas.
- **Legendas Estilizadas**: Suporta legendas no formato ASS com múltiplos estilos personalizáveis e destaque de palavras durante a fala (estilo CapCut).
- **Posicionamento de Legendas**: Permite posicionar as legendas no topo, centro ou parte inferior do vídeo.
- **Efeitos de Animação**: Inclui efeitos de animação nas palavras destacadas (pop, glow, slide).
- **Processamento Paralelo**: Suporta processamento paralelo de cenas para melhor desempenho.
- **Integração com Supabase**: Armazena informações dos vídeos gerados em banco de dados.
- **Integração com Wasabi**: Faz upload dos vídeos gerados para armazenamento em nuvem.
- **Transições Suaves**: Aplica fades entre cenas para uma transição suave.
- **Suporte Multi-usuário**: API projetada para lidar com múltiplas requisições de forma assíncrona.

## Pré-requisitos

- **Node.js**: Certifique-se de ter o Node.js instalado (versão 14 ou superior recomendada).
- **FFmpeg**: Instale o FFmpeg no seu sistema e certifique-se de que está acessível via linha de comando. Você pode baixá-lo em [ffmpeg.org](https://ffmpeg.org/download.html).
- **Supabase**: Crie uma conta no [Supabase](https://supabase.com/) para armazenamento de dados.
- **Wasabi**: Crie uma conta no [Wasabi](https://wasabi.com/) para armazenamento de vídeos.

## Instalação

1. Clone ou baixe este repositório.
2. Navegue até o diretório do projeto:
   ```
   cd video-generator-server
   ```
3. Instale as dependências:
   ```
   npm install
   ```
4. Crie um arquivo `.env` na raiz do projeto com a seguinte configuração:
   ```
   PORT=3000
   SUPABASE_URL=sua-url-do-supabase
   SUPABASE_ANON_KEY=sua-chave-anonima-do-supabase
   WASABI_ACCESS_KEY_ID=sua-chave-wasabi
   WASABI_SECRET_ACCESS_KEY=sua-chave-secreta-wasabi
   WASABI_BUCKET=seu-bucket-wasabi
   ```

## Uso

1. Inicie o servidor:
   ```
   npm start
   ```
   O servidor estará rodando em `http://localhost:3000` (ou na porta especificada no arquivo `.env`).

2. Envie uma requisição POST para `/generate-video` com um JSON contendo as cenas. Estrutura de exemplo:
   ```json
   {
     "orientation": "portrait",
     "subtitle_style": "neon",
     "subtitle_position": "center",
     "bg_audio_url": "https://exemplo.com/musica_fundo.mp3",
     "background_volume": 0.1,
     "webhook_url": "https://seu-webhook.com/callback",
     "scenes": [
       {
         "scene_number": 1,
         "image_url": "https://exemplo.com/imagem1.jpg",
         "audio_url": "https://exemplo.com/audio1.mp3",
         "subtitle_options": {
           "highlightColor": "&H000080FF"
         }
       },
       {
         "scene_number": 2,
         "image_url": "https://exemplo.com/imagem2.jpg",
         "audio_url": "https://exemplo.com/audio2.mp3"
       }
     ]
   }
   ```

3. A resposta da API incluirá o caminho do vídeo gerado e a URL no Wasabi:
   ```json
   {
     "message": "Vídeo gerado com sucesso!",
     "videoPath": "output/output_video_123456789.mp4",
     "videoUrl": "https://s3.wasabisys.com/seu-bucket/videos/proc_123456789/output_video_123456789.mp4"
   }
   ```

## Estilos de Legenda Disponíveis

O sistema suporta vários estilos de legenda, todos com destaque de palavras durante a fala:

- `default`: Estilo padrão com fonte Roboto Bold e efeito pop
- `retro`: Fonte Arial Black com cores vermelhas
- `neon`: Fonte Impact com cores azul neon e efeito glow
- `minimal`: Fonte Arial com design minimalista e efeito slide
- `modern`: Fonte Segoe UI com design moderno
- `subtle`: Fonte Calibri com design sutil
- `emoji`: Fonte Segoe UI Emoji
- `tiktok`: Fonte Segoe UI Black com cores rosa
- `youtuber`: Fonte Impact grande com efeito glow
- `movie`: Fonte Times New Roman com estilo de filme
- `capcut`: Estilo específico CapCut com fonte Montserrat Bold
- `capcut_neon`: Variação neon do estilo CapCut
- `capcut_minimal`: Variação minimalista do estilo CapCut

## Posições de Legenda

- `bottom`: Parte inferior do vídeo (padrão)
- `center`: Centro do vídeo
- `top`: Parte superior do vídeo

## Integração com Supabase

O sistema armazena informações sobre os vídeos gerados em uma tabela `videos` no Supabase com os seguintes campos:
- `process_id`: ID do processo de geração
- `output_path`: Caminho local do vídeo
- `orientation`: Orientação do vídeo
- `scenes_count`: Número de cenas
- `video_url`: URL do vídeo no Wasabi

## Solução de Problemas

- **Erro de FFmpeg**: Certifique-se de que o FFmpeg está instalado e acessível no PATH do sistema.
- **Erro de Supabase**: Verifique se as variáveis de ambiente SUPABASE_URL e SUPABASE_ANON_KEY estão configuradas corretamente.
- **Erro de Wasabi**: Verifique se as credenciais do Wasabi estão configuradas corretamente.
- **Problemas com Legendas no Windows**: Em sistemas Windows, certifique-se de que o caminho para o arquivo de legendas não contém espaços.

## Contribuição

Se você deseja contribuir para este projeto, por favor, abra uma issue ou envie um pull request com suas melhorias ou correções.

## Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo LICENSE para mais detalhes.
