-- Criar banco de dados
DROP DATABASE IF EXISTS controle_ativos;
CREATE DATABASE controle_ativos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE controle_ativos;

-- ========================
-- 1. Usuários do sistema (COM CAMPO 'permissoes')
-- ========================
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    role ENUM('administrador','controlador') NOT NULL DEFAULT 'controlador',
    permissoes JSON, -- Para salvar as permissões do perfil Controlador
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- 2. Funcionários
-- ========================
CREATE TABLE funcionarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    matricula VARCHAR(50) UNIQUE NOT NULL,
    cargo VARCHAR(100) NOT NULL,
    email VARCHAR(120),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- 3. Linhas telefônicas
-- ========================
CREATE TABLE linhas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero VARCHAR(20) UNIQUE NOT NULL,
    operadora VARCHAR(50) NOT NULL,
    plano VARCHAR(100),
    status ENUM('Ativa','Inativa','Cancelada') DEFAULT 'Ativa'
);

-- ========================
-- 4. Aparelhos
-- ========================
CREATE TABLE aparelhos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    modelo VARCHAR(100) NOT NULL,
    imei1 VARCHAR(50) UNIQUE NOT NULL,
    imei2 VARCHAR(50),
    linha_id INT,
    condicao ENUM('Novo','Aprovado para uso','Em manutenção','Danificado','Sinistrado', 'Com Defeito') DEFAULT 'Novo',
    observacoes TEXT,
    FOREIGN KEY (linha_id) REFERENCES linhas(id) ON DELETE SET NULL
);

-- ========================
-- 5. Registros de entrega/devolução (CORRIGIDO)
-- ========================
CREATE TABLE registros (
    id INT AUTO_INCREMENT PRIMARY KEY,
    funcionario_id INT NOT NULL,
    aparelho_id INT NOT NULL,
    data_entrega DATE NOT NULL,
    condicao_entrega VARCHAR(50),
    notas_entrega TEXT,
    acessorios JSON,
    termo_entrega_url VARCHAR(255),
    delivery_checker VARCHAR(100), -- <<-- ADICIONADO
    data_devolucao DATE,
    condicao_devolucao VARCHAR(50),
    notas_devolucao TEXT,
    termo_devolucao_url VARCHAR(255),
    bo_url VARCHAR(255),
    return_checker VARCHAR(100), -- <<-- ADICIONADO
    status ENUM('Em Uso','Devolvido') DEFAULT 'Em Uso',
    FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id),
    FOREIGN KEY (aparelho_id) REFERENCES aparelhos(id)
);

-- ========================
-- 6. Manutenções
-- ========================
CREATE TABLE manutencoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    aparelho_id INT NOT NULL,
    data_envio DATE NOT NULL,
    data_retorno DATE,
    defeito_reportado TEXT,
    servico_realizado TEXT,
    fornecedor VARCHAR(100),
    custo DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'Em manutenção',
    FOREIGN KEY (aparelho_id) REFERENCES aparelhos(id)
);

-- ========================
-- 7. Dados da Empresa
-- ========================
CREATE TABLE empresa (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    cnpj VARCHAR(20),
    logo LONGBLOB
);

-- ========================
-- 8. Usuário Administrador Padrão
-- ========================
-- Senha = admin123
INSERT INTO usuarios (nome, username, senha, role)
VALUES ('Administrador', 'admin', '$2b$12$YX.84a32hMy82z53x0fN6e.oVz./p4Lsp9N329gVhi1a4N2Xn.t0W', 'administrador');

-- ========================
-- 9. Histórico de Vinculação de Linhas
-- ========================
CREATE TABLE IF NOT EXISTS linha_historico (
    id INT AUTO_INCREMENT PRIMARY KEY,
    linha_id INT NOT NULL,
    aparelho_imei VARCHAR(50) NOT NULL,
    data_vinculacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_desvinculacao TIMESTAMP NULL,
    FOREIGN KEY (linha_id) REFERENCES linhas(id) ON DELETE CASCADE
);

-- ========================
-- 10. TABELA DE AUDITORIA (ADICIONADA)
-- ========================
CREATE TABLE auditoria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INT,
    username VARCHAR(100),
    action_type VARCHAR(50),
    target_resource VARCHAR(100),
    target_id VARCHAR(100),
    details JSON,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE SET NULL
);