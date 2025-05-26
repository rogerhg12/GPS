document.addEventListener('DOMContentLoaded', function() {
    const map = L.map('map').setView([0, 0], 2); // Zoom 2 mostra o mundo
    let userCurrentLocation = null; // Variável para armazenar a última localização do usuário
    let userLocationMarker = null; // Variável para armazenar o marcador "Você está aqui!"
    let currentRoutePolyline = null; // Variável para armazenar a polyline da rota atual
    let activeRouteCoordinates = []; // NOVO: Para armazenar os LatLngs da rota atual (formato [lat, lon])

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

            // NOVO: Verificar se há uma rota ativa e se o usuário está próximo dela
            if (activeRouteCoordinates.length > 0) { // Se uma rota foi desenhada
                const maxAllowedDistance = 50; // Distância máxima em metros para considerar "próximo" da rota
                if (!isNearRoute(userCurrentLocation, activeRouteCoordinates, maxAllowedDistance)) {
                    alert(`Você só pode avaliar o piso quando estiver perto da rota planejada (dentro de ${maxAllowedDistance} metros).`);
                    return; // Impede a avaliação se não estiver perto da rota
                }
            } else {
                alert('Por favor, planeje uma rota antes de avaliar o piso.');
                return;
            }
            // ESTE É O LOCAL ONDE SEU CÓDIGO ANTERIOR TERMINOU BRUSCAMENTE.
            // VOCÊ PRECISARÁ CONTINUAR A PARTIR DAQUI COM A LÓGICA DE AVALIAÇÃO.
            // POR ENQUANTO, APENAS FECHAREI AS CHAVES PARA CORRIGIR O ERRO DE SINTAXE.
        }); // Fecha o addEventListener para cada botão de avaliação
    }); // Fecha o forEach dos botões de avaliação

    // Adicione o restante do seu código JavaScript aqui, incluindo as funções
    // loadEvaluationsFromLocalStorage() e isNearRoute() e o código de planejamento de rotas
    // e avaliação de segmentos.

    // EXEMPLO DE FUNÇÕES FALTANTES (ADICIONE SEU CÓDIGO REAL AQUI)
    function loadEvaluationsFromLocalStorage() {
        // Implemente sua lógica para carregar avaliações do LocalStorage
        console.log("Função loadEvaluationsFromLocalStorage chamada.");
        return {}; // Retorna um objeto vazio por padrão
    }

    function isNearRoute(userLocation, routeCoordinates, maxDistance) {
        // Implemente sua lógica para verificar se o usuário está perto da rota
        // Você pode usar Turf.js aqui para calcular distâncias.
        console.log("Função isNearRoute chamada.");
        // Exemplo simples (você precisará de uma lógica real com Turf.js para isso)
        // Por exemplo, usando turf.pointToLineDistance ou turf.nearestPointOnLine
        if (routeCoordinates.length === 0) return false;
        // Apenas para que o script não quebre, retorne true se não houver rota definida
        // Você deve substituir isso pela sua lógica real.
        return true; 
    }

    // Código para os botões de planejamento de rota e avaliação de segmento
    const findRouteBtn = document.getElementById('findRouteBtn');
    const locateMeBtn = document.getElementById('locateMeBtn');
    const startSegmentEvaluationBtn = document.getElementById('startSegmentEvaluation');
    const endSegmentEvaluationBtn = document.getElementById('endSegmentEvaluation');

    findRouteBtn.addEventListener('click', function() {
        // Lógica para buscar rota
        alert('Funcionalidade Buscar Rota em desenvolvimento.');
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


}); // Fecha o document.addEventListener('DOMContentLoaded', function() { ... });
