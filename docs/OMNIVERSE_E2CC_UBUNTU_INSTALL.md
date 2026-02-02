# NVIDIA Omniverse + Earth-2 (E2CC) Installation Guide
## Ubuntu Server with GPU

---

## 📋 ТРЕБОВАНИЯ

### Hardware
| Компонент | Минимум | Рекомендуется |
|-----------|---------|---------------|
| **GPU** | NVIDIA RTX 4080 (16GB) | NVIDIA L40S / A100 / H100 |
| **CPU** | 12 cores, 4.0 GHz | 16+ cores, 4.5 GHz |
| **RAM** | 64 GB DDR4 | 128+ GB DDR5 |
| **Storage** | 1 TB NVMe SSD | 2+ TB NVMe SSD |
| **Network** | 1 Gbps | 10 Gbps |

### Software
| Компонент | Версия |
|-----------|--------|
| **Ubuntu** | 22.04 LTS (рекомендуется) |
| **NVIDIA Driver** | 550.127.05+ |
| **CUDA** | 12.6.1+ |
| **Docker** | 23.0.1+ |
| **NVIDIA Container Toolkit** | 1.13.5+ |
| **MicroK8s** | 1.29.13+ |

---

## 🔧 ПОШАГОВАЯ УСТАНОВКА

### STEP 1: Подготовка системы

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка базовых утилит
sudo apt install -y build-essential curl wget git software-properties-common

# Отключение nouveau (конфликтует с NVIDIA)
sudo bash -c "echo 'blacklist nouveau' >> /etc/modprobe.d/blacklist.conf"
sudo bash -c "echo 'options nouveau modeset=0' >> /etc/modprobe.d/blacklist.conf"
sudo update-initramfs -u

# Перезагрузка
sudo reboot
```

---

### STEP 2: Установка NVIDIA Driver

```bash
# Метод 1: Через ubuntu-drivers (рекомендуется)
sudo apt install -y ubuntu-drivers-common
ubuntu-drivers devices  # Показывает доступные драйверы

# Установка рекомендованного драйвера
sudo apt install -y nvidia-driver-550-server

# ИЛИ Метод 2: Через PPA (для последних версий)
sudo add-apt-repository ppa:graphics-drivers/ppa
sudo apt update
sudo apt install -y nvidia-driver-550

# Перезагрузка
sudo reboot

# Проверка установки
nvidia-smi
```

**Ожидаемый вывод nvidia-smi:**
```
+-----------------------------------------------------------------------------+
| NVIDIA-SMI 550.127.05   Driver Version: 550.127.05   CUDA Version: 12.4     |
|-------------------------------+----------------------+----------------------+
| GPU  Name        Persistence-M| Bus-Id        Disp.A | Volatile Uncorr. ECC |
| Fan  Temp  Perf  Pwr:Usage/Cap|         Memory-Usage | GPU-Util  Compute M. |
|===============================+======================+----------------=======|
|   0  NVIDIA L40S         Off  | 00000000:00:1E.0 Off |                    0 |
| N/A   30C    P8    24W / 350W |      1MiB / 46068MiB |      0%      Default |
+-------------------------------+----------------------+----------------------+
```

---

### STEP 3: Установка CUDA Toolkit

```bash
# Добавление CUDA репозитория
wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb
sudo dpkg -i cuda-keyring_1.1-1_all.deb
sudo apt update

# Установка CUDA
sudo apt install -y cuda-toolkit-12-6

# Добавление в PATH
echo 'export PATH=/usr/local/cuda/bin:$PATH' >> ~/.bashrc
echo 'export LD_LIBRARY_PATH=/usr/local/cuda/lib64:$LD_LIBRARY_PATH' >> ~/.bashrc
source ~/.bashrc

# Проверка
nvcc --version
```

---

### STEP 4: Установка Docker

```bash
# Удаление старых версий
sudo apt remove -y docker docker-engine docker.io containerd runc

# Установка зависимостей
sudo apt install -y ca-certificates gnupg lsb-release

# Добавление Docker GPG ключа
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Добавление репозитория
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Установка Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER
newgrp docker

# Проверка
docker --version
docker run hello-world
```

---

### STEP 5: Установка NVIDIA Container Toolkit

```bash
# Добавление репозитория
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

# Установка
sudo apt update
sudo apt install -y nvidia-container-toolkit

# Конфигурация Docker для использования NVIDIA runtime
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

# Проверка
docker run --rm --gpus all nvidia/cuda:12.6.0-base-ubuntu22.04 nvidia-smi
```

---

### STEP 6: Установка MicroK8s (для E2CC)

```bash
# Установка MicroK8s
sudo snap install microk8s --classic --channel=1.29/stable

# Добавление пользователя в группу
sudo usermod -a -G microk8s $USER
sudo chown -f -R $USER ~/.kube
newgrp microk8s

# Проверка статуса
microk8s status --wait-ready

# Включение необходимых add-ons
microk8s enable dns
microk8s enable helm3
microk8s enable registry
microk8s enable ingress
microk8s enable hostpath-storage

# Установка NVIDIA GPU Operator для MicroK8s
microk8s enable gpu

# Проверка GPU доступности
microk8s kubectl get nodes -o json | jq '.items[].status.capacity'
```

---

### STEP 7: NGC Authentication

```bash
# Установка NGC CLI
wget --content-disposition https://api.ngc.nvidia.com/v2/resources/nvidia/ngc-apps/ngc_cli/versions/3.41.4/files/ngccli_linux.zip
unzip ngccli_linux.zip
sudo mv ngc-cli /usr/local/bin/
sudo chmod +x /usr/local/bin/ngc-cli/ngc

# Добавление в PATH
echo 'export PATH=$PATH:/usr/local/bin/ngc-cli' >> ~/.bashrc
source ~/.bashrc

# Аутентификация (нужен NGC API Key с https://ngc.nvidia.com)
ngc config set
# Введите API Key, org, team при запросе

# Аутентификация Docker с NGC
docker login nvcr.io
# Username: $oauthtoken
# Password: <your-ngc-api-key>
```

---

### STEP 8: Установка Omniverse Enterprise

```bash
# Создание директории
mkdir -p ~/omniverse
cd ~/omniverse

# Скачивание Omniverse Launcher (с NGC)
wget https://install.launcher.omniverse.nvidia.com/installers/omniverse-launcher-linux.AppImage

# Права на выполнение
chmod +x omniverse-launcher-linux.AppImage

# Запуск (требуется GUI или VNC)
./omniverse-launcher-linux.AppImage

# Для headless серверов - установка через CLI
# Скачивание Nucleus Enterprise Server
ngc registry resource download-version "nvidia/omniverse/enterprise-nucleus-server:1.3.0" --dest ~/omniverse/nucleus

# Распаковка и установка
cd ~/omniverse/nucleus
./install.sh
```

---

### STEP 9: Earth-2 Weather Analytics Blueprint (E2CC)

**Вариант A — Helm (MicroK8s)** — если в репозитории есть `charts/`:

```bash
# Клонирование (официальный blueprint)
git clone https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics.git
cd earth2-weather-analytics

# Настройка переменных окружения
export NGC_API_KEY="your-ngc-api-key"
export DOCKER_REGISTRY="nvcr.io"

# Сборка и деплой через Helm (если есть charts/)
microk8s helm3 repo add nvidia https://helm.ngc.nvidia.com/nvidia
microk8s helm3 repo update

# Деплой Data Federation Mesh (DFM)
microk8s helm3 install dfm ./charts/dfm \
  --set image.repository=nvcr.io/nvidia/earth2/dfm \
  --set nvidia.apiKey=$NGC_API_KEY

# Деплой FourCastNet NIM
microk8s helm3 install fourcastnet ./charts/fourcastnet-nim \
  --set image.repository=nvcr.io/nvidia/earth2/fourcastnet-nim \
  --set nvidia.apiKey=$NGC_API_KEY

# Деплой E2CC (Earth-2 Climate Cloud)
microk8s helm3 install e2cc ./charts/e2cc \
  --set image.repository=nvcr.io/nvidia/earth2/e2cc \
  --set nvidia.apiKey=$NGC_API_KEY

# Проверка статуса
microk8s kubectl get pods
```

**Вариант B — Локальная сборка E2CC (как в нашем проекте)** — см. **OMNIVERSE_E2CC_SETUP.md**:

```bash
sudo apt install -y git-lfs xvfb
git clone https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics.git
cd earth2-weather-analytics
git lfs install && git lfs pull
cd e2cc
# Исправление версий расширений в source/apps/omni.earth_2_command_center.app_streamer.kit (см. раздел 2.1 в OMNIVERSE_E2CC_SETUP.md)
./build.sh --release --no-docker
cd ..
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX &
export DISPLAY=:99
./deploy/deploy_e2cc.sh -s
```

---

### STEP 10: Доступ к UI

```bash
# Получение IP
microk8s kubectl get ingress

# ИЛИ port-forward
microk8s kubectl port-forward svc/e2cc 8080:80

# Открыть в браузере: http://YOUR_SERVER_IP:8080
```

Для локальной сборки (Вариант B): Port Forward на порт streamer (часто 8010) и открыть в браузере. См. **OMNIVERSE_OPEN_IN_BROWSER.md**.

---

## 🔍 ПРОВЕРКА УСТАНОВКИ

```bash
# Checklist
echo "=== Installation Verification ==="
echo "1. NVIDIA Driver:" && nvidia-smi --query-gpu=driver_version --format=csv,noheader
echo "2. CUDA:" && nvcc --version | grep release
echo "3. Docker:" && docker --version
echo "4. NVIDIA Container Toolkit:" && docker run --rm --gpus all nvidia/cuda:12.6.0-base-ubuntu22.04 nvidia-smi | head -3
echo "5. MicroK8s:" && microk8s status | head -5
echo "6. NGC CLI:" && ngc --version
echo "7. E2CC Pods:" && microk8s kubectl get pods | grep e2cc
```

---

## ⚠️ TROUBLESHOOTING

| Проблема | Решение |
|----------|---------|
| `nvidia-smi` не работает | `sudo modprobe nvidia` или перезагрузка |
| Docker не видит GPU | `sudo systemctl restart docker` |
| MicroK8s GPU не активен | `microk8s disable gpu && microk8s enable gpu` |
| E2CC pod CrashLoopBackOff | Проверить `microk8s kubectl logs <pod-name>` |
| Permission denied | Проверить членство в группах: `groups $USER` |
| E2CC «Can't find extension» (6.2.2, 1.0.10, 107.0.3) | См. **OMNIVERSE_E2CC_SETUP.md** раздел 2.1 — заменить версии в `.kit` |
| E2CC «No app window» / «ResourceManager» | Запускать с Xvfb: `export DISPLAY=:99` и `Xvfb :99 -screen 0 1920x1080x24 -ac &` |

---

## 📚 ПОЛЕЗНЫЕ ССЫЛКИ

- [NVIDIA Omniverse Docs](https://docs.omniverse.nvidia.com/)
- [Earth-2 Weather Analytics Blueprint](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics)
- [NGC Catalog](https://catalog.ngc.nvidia.com/)
- [MicroK8s GPU Docs](https://microk8s.io/docs/addon-gpu)
- В этом репо: **OMNIVERSE_E2CC_SETUP.md**, **OMNIVERSE_OPEN_IN_BROWSER.md**, **SERVER_GPU_CLIMATE_OMNIVERSE.md**
