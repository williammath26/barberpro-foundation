# Testes de integração Supabase

Os testes deste diretório acessam um projeto Supabase real. Use preferencialmente um projeto separado de QA, nunca o banco de produção.

Configure no ambiente ou no arquivo `.env` da raiz do repositório:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `QA_USER_B_EMAIL`: e-mail de uma conta de teste com papel owner na loja QA
- `QA_USER_B_PASSWORD`: senha dessa conta de teste
- `QA_SHOP_ID`: UUID da barbearia usada pelos testes

Não versione o arquivo `.env` nem compartilhe as credenciais. O arquivo `.env.example` contém apenas os nomes das variáveis.

Para executar: `python -m pytest backend/tests`.
Os testes de integração serão ignorados automaticamente quando as variáveis obrigatórias não estiverem configuradas.
