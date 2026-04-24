# 📈 Stock Market Monitor

> Dashboard profesional del mercado bursátil construido con **FastAPI**, **React**, **Docker** y **Kubernetes**. Datos de bolsa en tiempo real, métricas financieras, opiniones de analistas y gráficos interactivos — todo desplegado en un clúster de Kubernetes listo para producción.

![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

---

## 🖥️ Vista previa

![Dashboard Preview](https://via.placeholder.com/1200x600/060a10/00c896?text=Stock+Market+Monitor+Dashboard)

---

## ✨ Características

- 📊 **Precios en tiempo real** a través de la API de Finnhub
- 🏢 **Perfil de empresas** — sector, capitalización bursátil, fecha de salida a bolsa y más
- 💹 **Gráficos de precios interactivos** con rangos 1S / 1M / 3M / 6M / 1A y barras de volumen
- 📉 **Métricas financieras** — Ingresos, EBITDA, EPS, P/E, ROE, márgenes
- 🎯 **Opiniones de analistas** — consenso, precios objetivo, desglose por firma
- 📰 **Sentimiento de noticias** — clasificación positiva/negativa y próximos eventos
- 🔍 **Buscador de acciones** — encuentra cualquier ticker en tiempo real
- 🐳 **Completamente containerizado** con Docker y Docker Compose
- ☸️ **Listo para Kubernetes** — Deployments, Services, Secrets, autoescalado HPA

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                   Clúster Kubernetes                    │
│                                                         │
│  ┌─────────────────────┐    ┌──────────────────────┐   │
│  │  Frontend (React)   │    │  Backend (FastAPI)   │   │
│  │  Nginx + NodePort   │───▶│  2 réplicas + HPA   │   │
│  │  Puerto: 30080      │    │  Puerto: 8000        │   │
│  └─────────────────────┘    └──────────────────────┘   │
│                                       │                 │
│                              ┌────────▼────────┐       │
│                              │   Finnhub API   │       │
│                              │   (Externo)     │       │
│                              └─────────────────┘       │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │   Secrets    │  │  ConfigMap   │  │     HPA     │  │
│  │  (API Keys)  │  │  (Config)    │  │ min:2 max:10│  │
│  └──────────────┘  └──────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 Estructura del proyecto

```
stock-market-monitor/
│
├── app/                          # Backend - FastAPI
│   ├── services/
│   │   └── finnhub.py            # Integración con Finnhub API
│   ├── main.py                   # Rutas de la API y configuración CORS
│   ├── requirements.txt          # Dependencias de Python
│   └── Dockerfile                # Contenedor del backend
│
├── frontend/                     # Frontend - React + TypeScript
│   ├── src/
│   │   ├── StockDashboard.jsx    # Componente principal del dashboard
│   │   └── App.tsx               # Punto de entrada de la app
│   ├── nginx.conf                # Configuración del proxy Nginx
│   └── Dockerfile                # Contenedor del frontend (multi-stage)
│
├── k8s/                          # Manifiestos de Kubernetes
│   ├── backend-deployment.yaml   # Deployment + Service del backend
│   ├── frontend-deployment.yaml  # Deployment + Service del frontend
│   └── hpa.yaml                  # HorizontalPodAutoscaler
│
├── docker-compose.yml            # Configuración para desarrollo local
└── README.md
```

---

## 🚀 Cómo ejecutarlo

### Requisitos previos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Minikube](https://minikube.sigs.k8s.io/docs/start/)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [API Key de Finnhub](https://finnhub.io) (plan gratuito disponible)

---

### Opción 1 — Docker Compose (Recomendado para desarrollo local)

```bash
# Clonar el repositorio
git clone https://github.com/Oscar-Alonso-dev/stock-market-monitor.git
cd stock-market-monitor

# Añadir tu API Key de Finnhub en docker-compose.yml
# Reemplaza: FINNHUB_API_KEY=tu_api_key_aqui

# Arrancar todo con un solo comando
docker-compose up --build
```

Abre el navegador en `http://localhost:3000` 🎉

---

### Opción 2 — Kubernetes (Entorno similar a producción)

```bash
# Arrancar Minikube
minikube start --driver=docker

# Cargar las imágenes Docker en Minikube
minikube image build -t stock-monitor:v1 ./app
minikube image build -t stock-frontend:v1 ./frontend

# Crear los secrets (añade tu API Key primero)
# Edita k8s/secrets.yaml y añade tu API Key de Finnhub

# Desplegar todo
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/hpa.yaml

# Abrir la aplicación
minikube service stock-frontend
```

---

## 🔄 CI/CD con GitHub Actions

El proyecto ya incluye un workflow en GitHub Actions en `.github/workflows/Docker.yaml`.

Actualmente el pipeline hace lo siguiente:

- Se ejecuta en `push` a `main` y en `pull_request` contra `main`
- Comprueba el código del backend con Python
- Comprueba el build del frontend con Node.js
- Construye las imágenes Docker de backend y frontend
- Publica ambas imágenes en **GitHub Container Registry (GHCR)** cuando el evento es un `push`
- Arranca los dos contenedores en el runner para validar que responden correctamente

Imágenes generadas por el workflow:

- `ghcr.io/<owner>/aurum-backend:latest`
- `ghcr.io/<owner>/aurum-frontend:latest`

Esto cubre la parte de **CI** y publicación de imágenes. El siguiente paso natural es añadir un job de **deploy** por SSH al servidor para ejecutar `docker compose pull` y `docker compose up -d`.

---

## 🔌 Endpoints de la API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/health` | Comprobación del estado |
| `GET` | `/stocks/{symbol}/quote` | Precio actual de una acción |
| `GET` | `/stocks/{symbol}/profile` | Perfil de la empresa |
| `GET` | `/stocks/search/{query}` | Búsqueda de acciones |

### Ejemplo de respuesta — `/stocks/AAPL/quote`

```json
{
  "symbol": "AAPL",
  "current_price": 189.43,
  "change": -1.23,
  "change_percent": -0.64,
  "high": 191.05,
  "low": 188.90,
  "open": 190.10,
  "previous_close": 190.66
}
```

---

## ☸️ Características de Kubernetes

| Característica | Detalles |
|----------------|---------|
| **Réplicas** | 2 pods del backend por defecto |
| **Autoescalado** | HPA escala de 2 a 10 pods al 70% de CPU |
| **Health checks** | Probes de liveness y readiness en `/health` |
| **Secrets** | API keys almacenadas como Kubernetes Secrets |
| **Proxy** | Nginx redirige `/api/*` al servicio del backend |
| **Política de reinicio** | `unless-stopped` en todos los contenedores |

---

## 🛠️ Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React 18, TypeScript, Gráficos SVG personalizados |
| **Backend** | Python 3.11, FastAPI, Uvicorn |
| **Datos** | Finnhub API |
| **Containerización** | Docker, Docker Compose |
| **Orquestación** | Kubernetes, Minikube |
| **Servidor web** | Nginx (Alpine) |
| **CI/CD** | GitHub Actions + GHCR |

---

## 📊 Secciones del dashboard

| Pestaña | Contenido |
|---------|-----------|
| **Resumen** | Ratios de valoración, márgenes de rentabilidad, balance |
| **Finanzas** | Gráficos de Ingresos, EBITDA, Beneficio Neto, EPS |
| **Analistas** | Consenso, precios objetivo, calificaciones por firma |
| **Noticias** | Análisis de sentimiento, próximos eventos |

---

## 🗺️ Próximas mejoras

- [ ] Datos financieros reales (EBITDA, EPS) via API premium
- [ ] Autenticación de usuarios y portfolios personales
- [ ] Alertas de precio y notificaciones
- [x] Pipeline CI/CD con GitHub Actions y publicación en GHCR
- [ ] Despliegue en la nube (GKE / EKS)
- [ ] Dominio propio y SSL

---

## 📄 Licencia

MIT License — siéntete libre de usar este proyecto para aprender o como base para tus propias aplicaciones.

---

## 👤 Autor

**Oscar Alonso**
- GitHub: [@Oscar-Alonso-dev](https://github.com/Oscar-Alonso-dev)

---

<div align="center">
  <p>Desarrollado con ❤️ usando FastAPI, React, Docker y Kubernetes</p>
  <p>⭐ ¡Dale una estrella si te ha sido útil!</p>
</div>
