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
// ... (restante do script.js)