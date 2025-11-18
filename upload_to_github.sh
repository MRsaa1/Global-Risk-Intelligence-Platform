#!/bin/bash
# Скрипт для загрузки Global Risk Intelligence Platform на GitHub

set -e

REPO_NAME="Global-Risk-Intelligence-Platform"
GITHUB_USER="MRsaa1"
REPO_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

echo "🚀 Загрузка Global Risk Intelligence Platform на GitHub..."

# Проверка что мы в правильной директории
if [ ! -f "README.md" ] || [ ! -d "apps" ]; then
    echo "❌ Ошибка: запустите скрипт из корня проекта global-risk-platform"
    exit 1
fi

# Проверка безопасности
echo "🔒 Проверка безопасности..."
if git ls-files | grep -q "\.env$"; then
    echo "⚠️  ВНИМАНИЕ: .env файл найден в git! Удалите его:"
    echo "   git rm --cached .env"
    exit 1
fi

# Добавляем все файлы проекта
echo "📦 Подготовка файлов..."
git add -A

# Коммит изменений
echo "💾 Создание коммита..."
git commit -m "Prepare for GitHub publication: Enhanced security, documentation" || echo "Нет изменений для коммита"

# Проверка remote
if git remote | grep -q "^origin$"; then
    echo "🔄 Remote 'origin' уже существует, обновляем..."
    git remote set-url origin ${REPO_URL}
else
    echo "➕ Добавляем remote 'origin'..."
    git remote add origin ${REPO_URL}
fi

# Переименовываем ветку в main если нужно
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "🔄 Переименовываем ветку в main..."
    git branch -M main
fi

# Загрузка на GitHub
echo "📤 Загрузка на GitHub..."
echo "   Репозиторий: ${REPO_URL}"
echo ""
echo "⚠️  ВАЖНО: Сначала создайте репозиторий на GitHub:"
echo "   1. Перейдите на https://github.com/new"
echo "   2. Название: ${REPO_NAME}"
echo "   3. Описание: Institutional-Grade Risk Analytics & Regulatory Compliance Platform"
echo "   4. Выберите Public"
echo "   5. НЕ создавайте README, .gitignore или license"
echo "   6. Нажмите 'Create repository'"
echo ""
read -p "Нажмите Enter после создания репозитория..."

git push -u origin main

echo ""
echo "✅ Проект успешно загружен на GitHub!"
echo "   URL: https://github.com/${GITHUB_USER}/${REPO_NAME}"

