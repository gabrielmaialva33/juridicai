---
title: Getting Started
---

<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 3rem; border-radius: 12px; color: white; margin-bottom: 2rem;">
  <h1 style="margin: 0; font-size: 2.5rem; font-weight: 700;">⚖️ JuridicAI API</h1>
  <p style="margin: 1rem 0 0 0; font-size: 1.25rem; opacity: 0.95;">
    API completa para gestão de escritórios de advocacia com suporte multi-tenant
  </p>
</div>

## 🚀 Início Rápido (5 minutos)

Comece a usar a API JuridicAI em menos de 5 minutos! Esta API permite gerenciar clientes, processos, prazos, documentos e eventos processuais em um ambiente multi-tenant seguro.

### Passo 1: Obtenha suas Credenciais

<div style="background: #f8f9fa; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #667eea; margin: 1rem 0;">
  <strong>📧 Contato:</strong> Entre em contato com nosso time para obter suas credenciais de API.
</div>

### Passo 2: Autentique-se

Faça login para obter seu token JWT:

```bash
curl -X POST https://api.juridicai.com.br/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "advogado@escritorio.com.br",
    "password": "sua_senha_segura"
  }'
```

**Resposta:**

```json
{
  "user": {
    "id": 1,
    "email": "advogado@escritorio.com.br",
    "full_name": "Dr. João Silva",
    "role": "lawyer"
  },
  "token": {
    "type": "bearer",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_at": "2024-12-31T23:59:59.000Z"
  }
}
```

### Passo 3: Configure o Tenant

<div style="background: #fff3cd; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #ffc107; margin: 1rem 0;">
  <strong>⚠️ Importante:</strong> A API JuridicAI utiliza arquitetura multi-tenant. Você DEVE incluir o header <code>X-Tenant-ID</code> em todas as requisições para recursos tenant-scoped (clientes, casos, prazos, documentos, eventos).
</div>

**Obtenha seu Tenant ID:**

```bash
curl -X GET https://api.juridicai.com.br/api/v1/tenants/me \
  -H "Authorization: Bearer seu_token_aqui"
```

**Resposta:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Silva & Advogados Associados",
  "subdomain": "silva-advogados",
  "plan": "professional",
  "is_active": true
}
```

### Passo 4: Faça sua Primeira Requisição

Crie um novo cliente:

```bash
curl -X POST https://api.juridicai.com.br/api/v1/clients \
  -H "Authorization: Bearer seu_token_aqui" \
  -H "X-Tenant-ID: 550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{
    "client_type": "individual",
    "full_name": "Maria Santos",
    "cpf": "123.456.789-09",
    "email": "maria@email.com",
    "phone": "(11) 98765-4321",
    "address": {
      "street": "Avenida Paulista",
      "number": "1578",
      "complement": "Apto 101",
      "neighborhood": "Bela Vista",
      "city": "São Paulo",
      "state": "SP",
      "zip_code": "01310-200",
      "country": "Brasil"
    }
  }'
```

**Resposta:**

```json
{
  "id": 1,
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "client_type": "individual",
  "full_name": "Maria Santos",
  "cpf": "123.456.789-09",
  "email": "maria@email.com",
  "phone": "(11) 98765-4321",
  "address": {
    "street": "Avenida Paulista",
    "number": "1578",
    "complement": "Apto 101",
    "neighborhood": "Bela Vista",
    "city": "São Paulo",
    "state": "SP",
    "zip_code": "01310-200",
    "country": "Brasil"
  },
  "is_active": true,
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

## 🔐 Arquitetura Multi-Tenant

A API JuridicAI implementa isolamento por linha (row-level isolation) com UUID para garantir que cada escritório (tenant) acesse apenas seus próprios dados.

### Headers Obrigatórios

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; margin: 1.5rem 0;">
  <div style="background: white; padding: 1.5rem; border-radius: 8px; border: 1px solid #e0e0e0;">
    <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">🔑</div>
    <h3 style="margin: 0.5rem 0;">Authorization</h3>
    <code>Bearer {token}</code>
    <p style="margin-top: 0.5rem; color: #666;">Token JWT obtido no login</p>
  </div>
  <div style="background: white; padding: 1.5rem; border-radius: 8px; border: 1px solid #e0e0e0;">
    <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">🏢</div>
    <h3 style="margin: 0.5rem 0;">X-Tenant-ID</h3>
    <code>{tenant_uuid}</code>
    <p style="margin-top: 0.5rem; color: #666;">UUID do escritório (tenant)</p>
  </div>
</div>

### Recursos que Exigem Tenant Context

- ✅ **Clientes** (`/api/v1/clients`)
- ✅ **Casos/Processos** (`/api/v1/cases`)
- ✅ **Prazos** (`/api/v1/deadlines`)
- ✅ **Documentos** (`/api/v1/documents`)
- ✅ **Eventos Processuais** (`/api/v1/case-events`)

### Recursos que NÃO Exigem Tenant Context

- ❌ **Autenticação** (`/api/v1/auth/*`)
- ❌ **Perfil do Usuário** (`/api/v1/profile`)
- ❌ **Gerenciamento de Tenants** (`/api/v1/tenants`)

## 💻 Exemplos de Código

### JavaScript / Node.js

```javascript
const axios = require('axios')

const API_URL = 'https://api.juridicai.com.br/api/v1'
const TOKEN = 'seu_token_jwt'
const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000'

// Configurar cliente HTTP
const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'X-Tenant-ID': TENANT_ID,
    'Content-Type': 'application/json',
  },
})

// Criar um novo caso
async function createCase() {
  try {
    const response = await client.post('/cases', {
      client_id: 1,
      case_number: '0000123-45.2024.8.26.0100',
      case_type: 'civil',
      status: 'active',
      priority: 'high',
      responsible_lawyer_id: 1,
      description: 'Ação de indenização por danos morais',
      court: 'TJ-SP',
      court_instance: '1ª Vara Cível',
      parties: {
        autor: {
          name: 'Maria Santos',
          cpf: '123.456.789-09',
          email: 'maria@email.com',
        },
        reu: {
          name: 'Empresa XYZ Ltda',
          cnpj: '12.345.678/0001-90',
          email: 'contato@empresa.com',
        },
      },
      case_value: 50000.0,
    })

    console.log('Caso criado:', response.data)
    return response.data
  } catch (error) {
    console.error('Erro ao criar caso:', error.response?.data || error.message)
    throw error
  }
}

// Listar prazos próximos
async function getUpcomingDeadlines() {
  try {
    const response = await client.get('/deadlines/upcoming', {
      params: {
        days: 7,
        is_completed: false,
      },
    })

    console.log('Prazos próximos:', response.data)
    return response.data
  } catch (error) {
    console.error('Erro ao buscar prazos:', error.response?.data || error.message)
    throw error
  }
}

// Executar
createCase()
getUpcomingDeadlines()
```

### Python

```python
import requests
from datetime import datetime

API_URL = 'https://api.juridicai.com.br/api/v1'
TOKEN = 'seu_token_jwt'
TENANT_ID = '550e8400-e29b-41d4-a716-446655440000'

# Configurar sessão
session = requests.Session()
session.headers.update({
    'Authorization': f'Bearer {TOKEN}',
    'X-Tenant-ID': TENANT_ID,
    'Content-Type': 'application/json'
})

# Criar um cliente pessoa física
def create_individual_client():
    url = f'{API_URL}/clients'
    payload = {
        'client_type': 'individual',
        'full_name': 'João da Silva',
        'cpf': '987.654.321-00',
        'email': 'joao@email.com',
        'phone': '(21) 99876-5432',
        'address': {
            'street': 'Rua das Flores',
            'number': '123',
            'neighborhood': 'Centro',
            'city': 'Rio de Janeiro',
            'state': 'RJ',
            'zip_code': '20010-000',
            'country': 'Brasil'
        },
        'tags': ['vip', 'pessoa-fisica']
    }

    try:
        response = session.post(url, json=payload)
        response.raise_for_status()
        print('Cliente criado:', response.json())
        return response.json()
    except requests.exceptions.HTTPError as e:
        print(f'Erro HTTP: {e.response.status_code}')
        print(f'Detalhes: {e.response.json()}')
        raise

# Buscar clientes com filtros
def search_clients(search_term=None, is_active=True, page=1):
    url = f'{API_URL}/clients'
    params = {
        'page': page,
        'per_page': 20,
        'is_active': is_active
    }

    if search_term:
        params['search'] = search_term

    try:
        response = session.get(url, params=params)
        response.raise_for_status()
        data = response.json()

        print(f"Total de clientes: {data['meta']['total']}")
        print(f"Página {data['meta']['current_page']} de {data['meta']['last_page']}")

        for client in data['data']:
            print(f"  - {client['full_name'] or client['company_name']} (ID: {client['id']})")

        return data
    except requests.exceptions.HTTPError as e:
        print(f'Erro: {e.response.status_code}')
        raise

# Executar
if __name__ == '__main__':
    client = create_individual_client()
    search_clients(is_active=True)
```

### PHP

```php
<?php

class JuridicAIClient {
    private $baseUrl = 'https://api.juridicai.com.br/api/v1';
    private $token;
    private $tenantId;

    public function __construct($token, $tenantId) {
        $this->token = $token;
        $this->tenantId = $tenantId;
    }

    private function request($method, $endpoint, $data = null) {
        $ch = curl_init($this->baseUrl . $endpoint);

        $headers = [
            'Authorization: Bearer ' . $this->token,
            'X-Tenant-ID: ' . $this->tenantId,
            'Content-Type: application/json'
        ];

        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

        if ($method === 'POST' || $method === 'PATCH') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
            if ($data) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            }
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode >= 400) {
            throw new Exception("HTTP Error $httpCode: $response");
        }

        return json_decode($response, true);
    }

    // Criar empresa (cliente pessoa jurídica)
    public function createCompanyClient($data) {
        return $this->request('POST', '/clients', $data);
    }

    // Criar prazo processual
    public function createDeadline($data) {
        return $this->request('POST', '/deadlines', $data);
    }

    // Buscar eventos de um caso
    public function getCaseEvents($caseId, $params = []) {
        $query = http_build_query($params);
        return $this->request('GET', "/cases/$caseId/events?$query");
    }

    // Completar prazo
    public function completeDeadline($deadlineId, $notes = null) {
        $data = $notes ? ['completion_notes' => $notes] : [];
        return $this->request('POST', "/deadlines/$deadlineId/complete", $data);
    }
}

// Uso
$client = new JuridicAIClient(
    'seu_token_jwt',
    '550e8400-e29b-41d4-a716-446655440000'
);

try {
    // Criar empresa
    $company = $client->createCompanyClient([
        'client_type' => 'company',
        'company_name' => 'Tech Solutions Ltda',
        'cnpj' => '12.345.678/0001-90',
        'email' => 'contato@techsolutions.com.br',
        'phone' => '(11) 3456-7890',
        'address' => [
            'street' => 'Avenida Faria Lima',
            'number' => '3500',
            'neighborhood' => 'Itaim Bibi',
            'city' => 'São Paulo',
            'state' => 'SP',
            'zip_code' => '04538-132',
            'country' => 'Brasil'
        ],
        'tags' => ['empresa', 'tecnologia']
    ]);

    echo "Empresa criada: " . $company['company_name'] . " (ID: " . $company['id'] . ")\n";

    // Criar prazo
    $deadline = $client->createDeadline([
        'case_id' => 1,
        'title' => 'Apresentar contestação',
        'description' => 'Prazo de 15 dias para contestar a ação',
        'due_date' => '2024-02-01',
        'responsible_user_id' => 1,
        'priority' => 'high',
        'is_fatal' => true,
        'alert_config' => [
            'alerts' => [
                ['days_before' => 7, 'sent' => false],
                ['days_before' => 3, 'sent' => false],
                ['days_before' => 1, 'sent' => false]
            ]
        ]
    ]);

    echo "Prazo criado: " . $deadline['title'] . "\n";

} catch (Exception $e) {
    echo "Erro: " . $e->getMessage() . "\n";
}
?>
```

## 🇧🇷 Domínio Jurídico Brasileiro

A API foi desenvolvida especificamente para o sistema jurídico brasileiro, com suporte nativo para:

### Formatos de Documentos

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin: 1.5rem 0;">
  <div style="background: #e3f2fd; padding: 1rem; border-radius: 8px;">
    <strong>CPF</strong> (Pessoa Física)<br/>
    <code>XXX.XXX.XXX-XX</code><br/>
    <small>Ex: 123.456.789-09</small>
  </div>
  <div style="background: #e8f5e9; padding: 1rem; border-radius: 8px;">
    <strong>CNPJ</strong> (Pessoa Jurídica)<br/>
    <code>XX.XXX.XXX/XXXX-XX</code><br/>
    <small>Ex: 12.345.678/0001-90</small>
  </div>
  <div style="background: #fff3e0; padding: 1rem; border-radius: 8px;">
    <strong>CNJ</strong> (Número Processual)<br/>
    <code>NNNNNNN-DD.AAAA.J.TR.OOOO</code><br/>
    <small>Ex: 0000123-45.2024.8.26.0100</small>
  </div>
  <div style="background: #fce4ec; padding: 1rem; border-radius: 8px;">
    <strong>CEP</strong> (Código Postal)<br/>
    <code>XXXXX-XXX</code><br/>
    <small>Ex: 01310-200</small>
  </div>
</div>

### Tipos de Casos/Processos

- **civil** - Casos cíveis
- **criminal** - Casos criminais
- **labor** - Trabalhista
- **family** - Família
- **tax** - Tributário
- **administrative** - Administrativo
- **other** - Outros

### Instâncias Judiciais

Suporte para todas as instâncias do judiciário brasileiro:

- Varas e Juizados (1ª instância)
- Tribunais de Justiça (TJ)
- Tribunais Regionais do Trabalho (TRT)
- Tribunais Regionais Federais (TRF)
- Superior Tribunal de Justiça (STJ)
- Tribunal Superior do Trabalho (TST)
- Supremo Tribunal Federal (STF)

## 🔍 Convenções da API

### Paginação

Todos os endpoints de listagem suportam paginação:

```bash
GET /api/v1/clients?page=1&per_page=20
```

**Resposta:**

```json
{
  "data": [...],
  "meta": {
    "total": 150,
    "per_page": 20,
    "current_page": 1,
    "last_page": 8,
    "first_page_url": "https://api.juridicai.com.br/api/v1/clients?page=1",
    "last_page_url": "https://api.juridicai.com.br/api/v1/clients?page=8",
    "next_page_url": "https://api.juridicai.com.br/api/v1/clients?page=2",
    "prev_page_url": null
  }
}
```

### Filtros e Busca

Use parâmetros de query para filtrar resultados:

```bash
# Buscar clientes ativos em São Paulo
GET /api/v1/clients?is_active=true&state=SP&search=Silva

# Buscar casos por tipo e status
GET /api/v1/cases?case_type=civil&status=active&priority=high

# Buscar prazos não cumpridos
GET /api/v1/deadlines?is_completed=false&priority=urgent
```

### Timestamps

Todos os timestamps são retornados em formato ISO 8601 (UTC):

```json
{
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z",
  "due_date": "2024-02-01T00:00:00.000Z"
}
```

### Soft Deletes

A API utiliza soft deletes através do campo `is_active`:

```bash
# Desativar um cliente (soft delete)
PATCH /api/v1/clients/1
{
  "is_active": false
}

# Filtrar apenas clientes ativos
GET /api/v1/clients?is_active=true
```

## ⚡ Rate Limiting

A API implementa rate limiting para proteger o serviço:

- **100 requisições por minuto** por tenant
- **1000 requisições por hora** por tenant
- **10000 requisições por dia** por tenant

Headers de resposta informam o status:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200
```

Quando o limite é atingido, você receberá:

```json
{
  "errors": [
    {
      "message": "Too many requests. Please try again later.",
      "code": "RATE_LIMIT_EXCEEDED"
    }
  ]
}
```

**HTTP Status:** `429 Too Many Requests`

## 🛡️ Segurança

### Autenticação JWT

Todos os endpoints (exceto `/health` e `/auth/login`) exigem autenticação JWT:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Tokens Expirados

Quando o token expira, você receberá:

```json
{
  "errors": [
    {
      "message": "Token has expired",
      "code": "TOKEN_EXPIRED"
    }
  ]
}
```

**HTTP Status:** `401 Unauthorized`

**Solução:** Faça login novamente para obter um novo token.

### HTTPS Obrigatório

Todas as requisições DEVEM ser feitas via HTTPS. Requisições HTTP serão rejeitadas.

### Isolamento de Dados

- Cada tenant acessa apenas seus próprios dados
- Validação rigorosa do `X-Tenant-ID` em cada requisição
- Tentativas de acessar dados de outros tenants resultam em erro `403 Forbidden`

## 🚨 Solução de Problemas

### Erro 401 - Unauthorized

**Causa:** Token JWT inválido ou ausente

**Solução:**

1. Verifique se o header `Authorization: Bearer {token}` está presente
2. Confirme que o token não expirou
3. Faça login novamente se necessário

### Erro 403 - Forbidden

**Causa:** Sem permissão ou tenant inválido

**Soluções:**

1. Verifique se o header `X-Tenant-ID` está correto
2. Confirme que o usuário tem permissão para a ação
3. Verifique se está tentando acessar recursos de outro tenant

### Erro 404 - Not Found

**Causa:** Recurso não encontrado

**Soluções:**

1. Confirme que o ID do recurso existe
2. Verifique se o recurso pertence ao tenant correto
3. Confirme que a URL está correta

### Erro 422 - Validation Error

**Causa:** Dados de entrada inválidos

**Exemplo de resposta:**

```json
{
  "errors": [
    {
      "message": "Validation failed",
      "rule": "regex",
      "field": "cpf",
      "meta": {
        "pattern": "^\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}$"
      }
    }
  ]
}
```

**Solução:** Corrija os dados de acordo com as regras de validação indicadas.

### Erro 429 - Too Many Requests

**Causa:** Rate limit excedido

**Solução:**

1. Aguarde o tempo indicado no header `X-RateLimit-Reset`
2. Implemente backoff exponencial em seus clientes
3. Cache resultados quando possível

## 📚 Recursos para Desenvolvedores

### Documentação Completa

- **OpenAPI Spec:** [openapi.yaml](./openapi.yaml)
- **Postman Collection:** Disponível via suporte
- **Exemplos HTTP:** [api.http](./api.http)

### Ambientes

- **Produção:** `https://api.juridicai.com.br`
- **Sandbox:** `https://sandbox-api.juridicai.com.br`
- **Documentação:** `https://docs.juridicai.com.br`

### Suporte

- **Email:** suporte@juridicai.com.br
- **Status da API:** https://status.juridicai.com.br
- **Changelog:** https://docs.juridicai.com.br/changelog

### SDKs Oficiais

Em breve disponíveis:

- SDK JavaScript/TypeScript
- SDK Python
- SDK PHP

---

<div style="background: #f8f9fa; padding: 2rem; border-radius: 8px; text-align: center; margin-top: 3rem;">
  <h3 style="margin: 0 0 1rem 0;">Pronto para começar? 🚀</h3>
  <p style="margin: 0; color: #666;">
    Explore a documentação completa na especificação OpenAPI ou entre em contato com nosso time de suporte.
  </p>
</div>
