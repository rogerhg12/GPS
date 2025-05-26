document.addEventListener('DOMContentLoaded', function() {
    const map = L.map('map').setView([0, 0], 2); // Zoom 2 mostra o mundo
    let userCurrentLocation = null; // Variável para armazenar a última localização do usuário
    let userLocationMarker = null; // Variável para armazenar o marcador "Você está aqui!"
    let currentRoutePolyline = null; // Variável para armazenar a polyline da rota atual
    let activeRouteCoordinates = []; // Para armazenar os LatLngs da rota atual (formato [lat, lon])

    // **NOVO: Variáveis para planejamento de rota**
    let originMarker = null; // Marcador para o ponto de origem
    let destinationMarker = null; // Marcador para o ponto de destino

    // **SUA CHAVE DE API DO OPENROUTESERVICE AQUI**
    // IMPORTANTE: Sua chave foi inserida abaixo!
    const OPENROUTESERVICE_API_KEY = '5b3ce3597851110001cf62483b983ee929414b2bbe3dc346ddc6c3da';

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

    // **NOVO: Funções de Geocodificação e Roteamento**

    async function geocodeAddress(address) {
        const url = `https://api.openrouteservice.org/geocode/search?api_key=${OPENROUTESERVICE_API_KEY}&text=${encodeURIComponent(address)}&boundary.country=BR`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Erro na geocodificação: ${response.statusText}`);
            }
            const data = await response.json();
            if (data.features && data.features.length > 0) {
                const coords = data.features[0].geometry.coordinates; // [lon, lat]
                return [coords[1], coords[0]]; // Retorna [lat, lon]
            } else {
                return null; // Endereço não encontrado
            }
        } catch (error) {
            console.error("Erro ao geocodificar:", error);
            alert("Erro ao geocodificar o endereço. Tente novamente.");
            return null;
        }
    }

    async function getRoute(originCoords, destinationCoords) {
        // As coordenadas para a API de roteamento são [lon, lat]
        const start = `${originCoords[1]},${originCoords[0]}`;
        const end = `${destinationCoords[1]},${destinationCoords[0]}`;
        const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${OPENROUTESERVICE_API_KEY}&start=${start}&end=${end}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`Erro ao buscar rota: ${response.statusText}`);
            }
            const data = await response.json();
            // A geometria da rota vem em um formato GeoJSON LineString
            const routeGeometry = data.features[0].geometry.coordinates; // [[lon, lat], [lon, lat], ...]
            // Converter para o formato [lat, lon] para Leaflet e armazenar
            return routeGeometry.map(coord => [coord[1], coord[0]]);
        } catch (error) {
            console.error("Erro ao obter a rota:", error);
            alert("Não foi possível calcular a rota. Verifique os endereços e sua conexão.");
            return null;
        }
    }

    // **NOVO: Event Listener para o botão Buscar Rota**
    findRouteBtn.addEventListener('click', async function() {
        const originAddress = originInput.value.trim();
        const destinationAddress = destinationInput.value.trim();

        if (!originAddress || !destinationAddress) {
            alert('Por favor, insira o endereço de origem e destino.');
            return;
        }

        // 1. Geocodificar origem
        const originCoords = await geocodeAddress(originAddress);
        if (!originCoords) {
            alert('Origem não encontrada. Verifique o endereço.');
            return;
        }

        // 2. Geocodificar destino
        const destinationCoords = await geocodeAddress(destinationAddress);
        if (!destinationCoords) {
            alert('Destino não encontrado. Verifique o endereço.');
            return;
        }

        // Limpar marcadores e rota anteriores
        if (originMarker) map.removeLayer(originMarker);
        if (destinationMarker) map.removeLayer(destinationMarker);
        if (currentRoutePolyline) map.removeLayer(currentRoutePolyline);

        // Adicionar marcadores de origem e destino
        originMarker = L.marker(originCoords).addTo(map).bindPopup('Origem').openPopup();
        destinationMarker = L.marker(destinationCoords).addTo(map).bindPopup('Destino').openPopup();

        // 3. Obter a rota
        const routeCoords = await getRoute(originCoords, destinationCoords);

        if (routeCoords && routeCoords.length > 0) {
            // Desenhar a rota no mapa
            currentRoutePolyline = L.polyline(routeCoords, { color: 'blue', weight: 5 }).addTo(map);
            map.fitBounds(currentRoutePolyline.getBounds()); // Ajustar o zoom para a rota
            activeRouteCoordinates = routeCoords; // Armazenar para uso futuro (avaliação de trecho)
            alert('Rota encontrada e desenhada!');
        } else {
            alert('Não foi possível encontrar uma rota entre os locais especificados.');
        }
    });


    locateMeBtn.addEventListener('click', getUserLocationAndCenterMap);

    startSegmentEvaluationBtn.addEventListener('click', function() {
        // Lógica para iniciar avaliação de trecho
        alert('Funcionalidade Iniciar Avaliação de Trecho em desenvolvimento.');
        endSegmentEvaluationBtn.disabled = false;
        startSegmentEvaluationBtn.disabled = true;
    });

    endSegmentEvaluationBtn.addEventListener('click', function() {
        // Lógica para finalizar avaliação de trecho
        alert('Funcionalidade Finalizar Avaliação em desenvolvimento.');
        startSegmentEvaluationBtn.disabled = false;
        endSegmentEvaluationBtn.disabled = true;
    });

    // Funções de Exemplo (seus placeholders anteriores)
    function loadEvaluationsFromLocalStorage() {
        console.log("Função loadEvaluationsFromLocalStorage chamada.");
        return {};
    }

    function isNearRoute(userLocation, routeCoordinates, maxDistance) {
        console.log("Função isNearRoute chamada.");
        // Esta função precisa ser implementada com Turf.js para checar a proximidade.
        // Por enquanto, ela retorna true se houver rota, para permitir a avaliação de ponto.
        // Você usará turf.pointToLineDistance para uma checagem precisa.
        return activeRouteCoordinates.length > 0; // Temporário: Retorna true se houver rota ativa
    }

}); // Fecha o document.addEventListener('DOMContentLoaded', function() { ... });
