# Shared libraries and schemas

Общие библиотеки и схемы платформы (PARS, типы, константы).

## Структура

- **pars/** — PARS Protocol (Physical Asset Risk Schema), Layer 5.
  - Схема v1 и описание формата см. в `apps/api/data/schemas/pars-asset-v1.json` и в API: `GET /api/v1/pars/schema`.
  - Здесь можно хранить копию схемы или ссылку на неё для standalone-инструментов и консьюмеров вне API.

## Использование

- API использует схему из `apps/api/data/schemas/pars-asset-v1.json`.
- Внешние системы могут брать схему через `GET /api/v1/pars/schema` или из этой директории после добавления файлов.

## Дальнейшее

- При появлении общих типов (юрисдикции, форматы дат, коды регуляций) — вынести в `libs/shared/` или отдельный пакет.
