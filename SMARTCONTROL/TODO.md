# TODO: Correção de Bugs no SMARTCONTROL

## Bugs Identificados
- [x] Mover `request.get_json()` para dentro do bloco try em rotas afetadas (user_routes.py, records_routes.py, etc.)
- [x] Mover conversões `int()` para dentro do bloco try em records_routes.py
- [x] Corrigir decorators.py para evitar abort duplicado em caso de HTTPException
- [ ] Ajustar indentação inconsistente em alguns arquivos
- [ ] Testar as correções após implementação

## Arquivos a Modificar
- SMARTCONTROL/routes/user_routes.py
- SMARTCONTROL/routes/records_routes.py
- SMARTCONTROL/routes/decorators.py
- Outros arquivos conforme necessário
