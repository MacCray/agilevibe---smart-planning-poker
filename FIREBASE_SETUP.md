# Настройка Firebase для AgileVibe

Это руководство поможет вам настроить Firebase Firestore для работы приложения AgileVibe с real-time синхронизацией.

## Шаг 1: Создание проекта Firebase

1. Перейдите на [Firebase Console](https://console.firebase.google.com/)
2. Нажмите "Add project" (Добавить проект)
3. Введите название проекта (например, "agilevibe")
4. Отключите Google Analytics (не обязательно для бесплатного плана)
5. Нажмите "Create project"

## Шаг 2: Создание Firestore Database

1. В меню слева выберите **Firestore Database**
2. Нажмите "Create database"
3. Выберите режим: **Start in test mode** (для начала можно использовать тестовый режим)
4. Выберите регион (например, `us-central` или ближайший к вам)
5. Нажмите "Enable"

⚠️ **Важно**: В тестовом режиме база данных открыта для чтения/записи на 30 дней. После этого нужно настроить правила безопасности.

## Шаг 3: Настройка правил безопасности Firestore

1. Перейдите на вкладку **Rules** в Firestore
2. Замените правила на следующие:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Разрешаем доступ к комнатам
    match /rooms/{roomId} {
      // Любой может читать и писать состояние комнаты
      allow read, write: if true;
      
      // Участники комнаты
      match /participants/{participantId} {
        // Любой может читать и писать данные участников
        allow read, write: if true;
      }
    }
  }
}
```

3. Нажмите "Publish"

⚠️ **Безопасность**: Эти правила открывают доступ для всех. Для продакшена рекомендуется добавить аутентификацию и более строгие правила.

## Шаг 4: Включение Firebase Hosting

1. В Firebase Console в меню слева выберите **Hosting**
2. Нажмите "Get started"
3. Следуйте инструкциям для начальной настройки (можно пропустить, если хотите настроить позже)

## Шаг 5: Получение конфигурации Firebase

1. В Firebase Console перейдите в **Project Settings** (⚙️ рядом с "Project Overview")
2. Прокрутите вниз до раздела "Your apps"
3. Нажмите на иконку веб-приложения (`</>`)
4. Введите название приложения (например, "AgileVibe Web")
5. Нажмите "Register app"
6. Скопируйте конфигурацию Firebase (она будет выглядеть так):

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## Шаг 6: Настройка переменных окружения

1. Создайте файл `.env.local` в корне проекта (если его еще нет)
2. Добавьте следующие переменные с вашими значениями из Firebase:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

# Gemini API (если еще не настроен)
GEMINI_API_KEY=your-gemini-api-key
```

3. Сохраните файл

⚠️ **Важно**: Файл `.env.local` уже должен быть в `.gitignore`, чтобы не попасть в репозиторий.

## Шаг 7: Настройка Firebase CLI и проекта

1. Установите Firebase CLI глобально (если еще не установлен):
   ```bash
   npm install -g firebase-tools
   ```

2. Войдите в Firebase:
   ```bash
   firebase login
   ```

3. Инициализируйте Firebase в проекте:
   ```bash
   firebase init hosting
   ```
   
   При инициализации:
   - Выберите ваш Firebase проект
   - Укажите `dist` как публичную директорию
   - На вопрос "Configure as a single-page app" ответьте **Yes**
   - На вопрос "Set up automatic builds and deploys with GitHub" ответьте **No** (мы сделаем это вручную)

4. Обновите файл `.firebaserc` с вашим project ID:
   ```json
   {
     "projects": {
       "default": "your-project-id"
     }
   }
   ```

## Шаг 8: Деплой на Firebase Hosting

### Локальный деплой

1. Соберите проект:
   ```bash
   npm run build
   ```

2. Задеплойте на Firebase Hosting:
   ```bash
   npm run deploy
   ```
   
   Или напрямую:
   ```bash
   firebase deploy --only hosting
   ```

3. После деплоя вы получите URL вида: `https://your-project-id.web.app`

### Автоматический деплой через GitHub Actions (опционально)

Если хотите автоматизировать деплой при push в репозиторий, создайте файл `.github/workflows/firebase-deploy.yml`:

```yaml
name: Deploy to Firebase Hosting

on:
  push:
    branches: [main, master]
  workflow_dispatch:

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      
      - name: Install dependencies
        run: npm install
      
      - name: Build
        run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
      
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
```

Для автоматического деплоя также нужно добавить `FIREBASE_SERVICE_ACCOUNT` в GitHub Secrets (см. [документацию](https://github.com/FirebaseExtended/action-hosting-deploy)).

## Шаг 9: Установка зависимостей и тестирование

1. Установите зависимости:
```bash
npm install
```

2. Запустите приложение локально:
```bash
npm run dev
```

3. Откройте два браузера и проверьте синхронизацию в реальном времени

## Преимущества Firebase Hosting

- ✅ **Бесплатный** - 10 GB хранения и 360 MB/день трафика
- ✅ **Быстрый CDN** - автоматическое распространение по всему миру
- ✅ **SSL сертификаты** - автоматические HTTPS сертификаты
- ✅ **Простой деплой** - одна команда `firebase deploy`
- ✅ **Интеграция** - идеально работает с Firestore и другими Firebase сервисами
- ✅ **Кастомные домены** - можно подключить свой домен бесплатно
- ✅ **Preview каналы** - можно создавать preview версии для тестирования

## Бесплатный план Firebase (Spark)

Firebase предоставляет бесплатный план Spark с следующими лимитами:

- **Firestore**: 
  - 50K чтений/день
  - 20K записей/день
  - 20K удалений/день
  - 1 GB хранения

- **Hosting**:
  - 10 GB хранения
  - 360 MB/день трафика
  - SSL сертификаты включены

Эти лимиты более чем достаточны для небольшого приложения Planning Poker.

## Устранение проблем

### Приложение не синхронизируется

1. Проверьте, что все переменные окружения установлены правильно
2. Проверьте консоль браузера на наличие ошибок
3. Убедитесь, что Firestore Database создана и активна
4. Проверьте правила безопасности Firestore

### Ошибки при деплое

1. Убедитесь, что вы вошли в Firebase CLI: `firebase login`
2. Проверьте, что project ID в `.firebaserc` правильный
3. Убедитесь, что Firebase Hosting включен в консоли
4. Проверьте, что директория `dist` существует после сборки
5. Для автоматического деплоя проверьте, что все секреты добавлены в GitHub

## Дополнительные ресурсы

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firebase Hosting Documentation](https://firebase.google.com/docs/hosting)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [Firebase Pricing](https://firebase.google.com/pricing)

