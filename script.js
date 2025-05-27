document.addEventListener('DOMContentLoaded', function() {
    const map = L.map('map').setView([0, 0], 2); // Zoom 2 mostra o mundo
    let userCurrentLocation = null; // Variável para armazenar a última localização do usuário
    let userLocationMarker = null; // Variável para armazenar o marcador "Você está aqui!"
    let currentRoutePolyline = null; // Variável para armazenar a polyline da rota atual
    let activeRouteCoordinates = []; // Para armazenar os LatLngs da rota atual (formato [lat, lon])

    // Variáveis para planejamento de rota
    let originMarker = null; // Marcador para o ponto de origem
    let destinationMarker = null; // Marcador para o ponto de destino

    // SUA CHAVE DE API DO OPENROUTESERVICE AQUI
    const OPENROUTESERVICE_API_KEY = '5b3ce3597851110001cf62483b983ee929414b2bbe3dc346ddc6c3da';

    // URL do proxy AllOrigins
    const CORS_PROXY_URL = 'https://api.allorigins.win/raw?url=';

    // Coordenadas do centro de prioridade (Porto Alegre)
    const GEOCENTRIC_LAT = -30.0346; // Latitude de Porto Alegre
    const GEOCENTRIC_LON = -51.2177; // Longitude de Porto Alegre

    // As avaliações persistirão no LocalStorage
    const storedEvaluations = loadEvaluationsFromLocalStorage();

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Função para obter a localização do usuário e centralizar o mapa
    function getUserLocationAndCenterMap() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    userCurrentLocation = [lat, lon]; // Atualiza a localização do usuário

                    map.setView(userCurrentLocation, 16); // Centraliza o mapa com zoom 16

                    // Adiciona/Atualiza o marcador "Você está aqui!"
                    if (userLocationMarker) {
                        map.removeLayer(userLocationMarker); // Remove o marcador antigo
                    }
                    userLocationMarker = L.marker(userCurrentLocation)
                        .addTo(map)
                        .bindPopup('Você está aqui!')
                        .openPopup();

                    console.log('Localização atualizada e mapa centralizado:', userCurrentLocation);

                },
                (error) => {
                    console.error('Erro ao obter a localização:', error);
                    let errorMessage = 'Não foi possível obter sua localização. Por favor, habilite a geolocalização no seu navegador e/ou verifique sua conexão.';
                    if (error.code === error.PERMISSION_DENIED) {
                        errorMessage = 'Acesso à localização negado. Por favor, permita o acesso à localização nas configurações do navegador.';
                    } else if (error.code === error.TIMEOUT) {
                        errorMessage = 'Tempo limite excedido ao tentar obter a localização. Tente novamente.';
                    }
                    alert(errorMessage);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            alert('Seu navegador não suporta geolocalização.');
        }
    }

    // Chamar a função uma vez no carregamento inicial da página para centralizar
    getUserLocationAndCenterMap();

    // Seleciona todos os botões de avaliação
    const evaluationButtons = document.querySelectorAll('.evaluation-btn');

    // Adiciona um "listener" de clique para cada botão
    evaluationButtons.forEach(button => {
        button.addEventListener('click', function() {
            if (!userCurrentLocation) {
                alert('Por favor, aguarde enquanto obtemos sua localização antes de avaliar.');
                return;
            }

            if (activeRouteCoordinates.length > 0) {
                const maxAllowedDistance = 50;
                if (!isNearRoute(userCurrentLocation, activeRouteCoordinates, maxAllowedDistance)) {
                    alert(`Você só pode avaliar o piso quando estiver perto da rota planejada (dentro de ${maxAllowedDistance} metros).`);
                    return;
                }
            } else {
                alert('Por favor, planeje uma rota antes de avaliar o piso.');
                return;
            }
            // Lógica de avaliação de ponto (será adicionada mais tarde)
            alert('Avaliação de ponto clicada!');
        });
    });

    // Código para os botões de planejamento de rota e avaliação de segmento
    const findRouteBtn = document.getElementById('findRouteBtn');
    const locateMeBtn = document.getElementById('locateMeBtn');
    const originInput = document.getElementById('originInput');
    const destinationInput = document.getElementById('destinationInput');
    const startSegmentEvaluationBtn = document.getElementById('startSegmentEvaluation');
    const endSegmentEvaluationBtn = document.getElementById('endSegmentEvaluation');

    // **NOVAS VARIÁVEIS PARA AUTOCOMPLETAR**
    const originSuggestions = document.getElementById('originSuggestions');
    const destinationSuggestions = document.getElementById('destinationSuggestions');
    let debounceTimeout;

    // Funções de Geocodificação e Roteamento

    async function geocodeAddress(address) {
        if (!address) return null; // Não faça requisição com endereço vazio

        const openRouteServiceUrl = `https://api.openrouteservice.org/geocode/search?api_key=<span class="math-inline">\{OPENROUTESERVICE\_API\_KEY\}&text\=</span>{encodeURIComponent(address)}&boundary.country=BR&point.lat=<span class="math-inline">\{GEOCENTRIC\_LAT\}&point\.lon\=</span>{GEOCENTRIC_LON}`;
        const url = `<span class="math-inline">\{CORS\_PROXY\_URL\}</span>{encodeURIComponent(openRouteServiceUrl)}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Erro na geocodificação: ${response.statusText}`);
            }
            const data = await response.json();
            // A API de geocodificação retorna uma lista de features.
            // Para autocompletar, queremos todas as features.
            return data.features;
        } catch (error) {
            console.error("Erro ao geocodificar:", error);
            // Removido o alert aqui para não incomodar no autocompletar,
            // o erro será tratado quando o usuário tentar buscar a rota.
            return null;
        }
    }

    async function getRoute(originCoords, destinationCoords) {
        const start = `${originCoords
