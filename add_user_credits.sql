-- Adicionar ou atualizar informações do usuário na tabela users
INSERT INTO users (id, email, credits)
VALUES ('9939d25e-82e5-40da-9590-fcb2d84f7d11', 'seu_email@exemplo.com', 100)
ON CONFLICT (id)
DO UPDATE SET credits = 100, updated_at = NOW();

-- Para verificar os dados inseridos
SELECT * FROM users WHERE id = '9939d25e-82e5-40da-9590-fcb2d84f7d11';
