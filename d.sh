----------------------------------------------
#!/bin/bash

# Обновление списка пакетов и установка необходимых зависимостей
sudo apt-get update
sudo apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Удаление старых версий Docker, если они установлены
for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do sudo apt-get remove -y $pkg; done

# Добавление официального GPG-ключа Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Добавление репозитория Docker в список источников пакетов
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Обновление списка пакетов после добавления нового репозитория
sudo apt-get update

# Установка последней версии Docker
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# (Опционально, но рекомендуется) Добавление вашего пользователя в группу docker
# Это позволит вам выполнять команды docker без использования sudo.
# ВАЖНО: После выполнения этой команды вам нужно будет выйти из системы и снова войти,
# чтобы изменения вступили в силу.
sudo usermod -aG docker $USER

# Вывод информации об успешной установке
echo ""
echo "Docker успешно установлен!"
echo "Версия Docker:"
docker --version
echo ""
echo "Чтобы использовать docker без 'sudo', пожалуйста, выйдите из системы и войдите снова."
echo "После этого вы можете проверить работу Docker командой: docker run hello-world"



------------------
