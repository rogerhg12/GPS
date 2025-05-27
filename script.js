document.addEventListener('DOMContentLoaded', () => {
    // Chaves de API
    const OPENROUTESERVICE_API_KEY = '5b3ce3597851110001cf62483b983ee929414b2bbe3dc346ddc6c3da'; // Sua chave OpenRouteService
    const CORS_PROXY_URL = 'https://api.allorigins.win/raw?url='; // Proxy para contornar problemas de CORS

    // Inicialização do Mapa Leaflet
    const map = L.map('map').setView([-30.0346, -51.2177], 13); // Centro em Porto Alegre
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    let currentRouteLayer = null; // Para armazenar a rota atual
    let userLocationMarker = null; // Para o marcador de localização do usuário
    let evaluations = {}; // Objeto para armazenar as avaliações
    let evaluationMarkers = L.layerGroup().addTo(map); // Grupo de marcadores de avaliação
    let currentSegmentPolyline = null; // Polilinha para o segmento sendo avaliado
    let segmentEvaluationActive = false; // Flag para controlar se a avaliação de segmento está ativa
    let segmentCoordinates = []; // Armazena as coordenadas para avaliação de segmento

    // Elementos do DOM
    const origemInput = document.getElementById('origem');
    const destinoInput = document.getElementById('destino');
    const buscarRotaBtn = document.getElementById('buscar-rota');
    const minhaLocalizacaoBtn = document.getElementById('minha-localizacao');
    const origemSuggestions = document.getElementById('origem-suggestions');
    const destinoSuggestions = document.getElementById('destino-suggestions');
    const evaluationButtons = document.querySelectorAll('.evaluation-btn'); // Seleciona todos os botões com essa classe
    const iniciarAvaliacaoBtn = document.getElementById('iniciar-avaliacao');
    const finalizarAvaliacaoBtn = document.getElementById('finalizar-avaliacao');

    // Funções de localStorage
    function saveEvaluationsToLocalStorage() {
        localStorage.setItem('pisoEvaluations', JSON.stringify(evaluations));
    }

    function loadEvaluationsFromLocalStorage() {
        console.log("Função loadEvaluationsFromLocalStorage chamada.");
        const stored = localStorage.getItem('pisoEvaluations');
        if (stored) {
            return JSON.parse(stored);
        } else {
            console.log("Nenhuma avaliação no localStorage, carregando exemplos.");
            // Avaliações de exemplo (5 tipos) - Estes são os marcadores no mapa
            return {
                "Ponto 1": {
                    latitude: -30.0336, // Perto do centro de Porto Alegre
                    longitude: -51.2227,
                    rating: "Bom",
                    timestamp: Date.now() - 86400000, // 1 dia atrás
                    comment: "Piso bem conservado, fácil de usar."
                },
                "Ponto 2": {
                    latitude: -30.0380,
                    longitude: -51.2100,
                    rating: "Regular",
                    timestamp: Date.now() - 172800000, // 2 dias atrás
                    comment: "Alguns buracos, mas transitável."
                },
                "Ponto 3": {
                    latitude: -30.0450,
                    longitude: -51.2300,
                    rating: "Ruim",
                    timestamp: Date.now() - 259200000, // 3 dias atrás
                    comment: "Piso irregular e com muitas rachaduras."
                },
                "Ponto 4": {
                    latitude: -30.0250,
                    longitude: -51.2050,
                    rating: "Ótimo", // Alterado para "Ótimo"
                    timestamp: Date.now() - 345600000, // 4 dias atrás
                    comment: "Novo asfalto, muito liso."
                },
                "Ponto 5": {
                    latitude: -30.0300,
                    longitude: -51.2200,
                    rating: "Péssimo", // Alterado para "Péssimo"
                    timestamp: Date.now() - 432000000, // 5 dias atrás
                    comment: "Calçada com muitas pedras soltas e buracos."
                }
            };
        }
    }

    function addEvaluationsToMap(evals) {
        evaluationMarkers.clearLayers(); // Remove marcadores antigos
        for (const key in evals) {
            const evaluation = evals[key];

            // Mapeia a avaliação para uma cor
            const markerColor = {
                "Ótimo": '#1a8f4c', // Verde mais escuro
                "Bom": 'green',
                "Regular": 'orange',
                "Ruim": 'red',
                "Péssimo": '#8c0000' // Vermelho mais escuro
            }[evaluation.rating];

            const customMarkerHtml = `
                <div style="
                    background-color: ${markerColor};
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    border: 2px solid white;
                    box-shadow: 0 0 5px rgba(0,0,0,0.5);
                "></div>
            `;
            const customIcon = L.divIcon({
                className: 'custom-evaluation-icon',
                html: customMarkerHtml,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
            
            // Verifica se latitude e longitude são números válidos antes de criar o marcador
            if (typeof evaluation.latitude === 'number' && typeof evaluation.longitude === 'number') {
                L.marker([evaluation.latitude, evaluation.longitude], { icon: customIcon, isEvaluationMarker: true })
                    .addTo(evaluationMarkers) // Adiciona ao layerGroup
                    .bindPopup(`
                        <strong>Avaliação:</strong> ${evaluation.rating}<br>
                        <strong>Comentário:</strong> ${evaluation.comment || 'N/A'}<br>
                        <strong>Data:</strong> ${new Date(evaluation.timestamp).toLocaleDateString()}
                    `);
            } else {
                console.error("Erro: Avaliação com coordenadas inválidas. Ignorando marcador:", evaluation);
            }
        }
        console.log("Avaliações adicionadas ao mapa.");
    }

    // Função para geocodificação (converter endereço em coordenadas)
    async function geocodeAddress(address, searchLat, searchLon) {
        try {
            // A URL da API do OpenRouteService e o proxy AllOrigins
            const openRouteServiceUrl = `https://api.openrouteservice.org/geocode/search?api_key=${OPENROUTESERVICE_API_KEY}&text=${encodeURIComponent(address)}&boundary.country=BR&point.lat=${searchLat}&point.lon=${searchLon}`;
            const url = `${CORS_PROXY_URL}${encodeURIComponent(openRouteServiceUrl)}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data.features.length > 0 ? data.features[0].geometry.coordinates : null;
        } catch (error) {
            console.error('Erro na geocodificação:', error);
            alert('Não foi possível encontrar o endereço. Verifique e tente novamente.');
            return null;
        }
    }

    // Função para buscar rota
    async function fetchRoute(origemCoords, destinoCoords) {
        try {
            const routeUrl = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${OPENROUTESERVICE_API_KEY}&start=${origemCoords[0]},${origemCoords[1]}&end=${destinoCoords[0]},${destinoCoords[1]}`;
            const url = `${CORS_PROXY_URL}${encodeURIComponent(routeUrl)}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data.features.length > 0 ? data.features[0].geometry.coordinates : null;
        } catch (error) {
            console.error('Erro ao buscar rota:', error);
            alert('Não foi possível calcular a rota. Tente novamente mais tarde.');
            return null;
        }
    }

    // Função para mostrar a rota no mapa
    function displayRoute(coordinates) {
        if (currentRouteLayer) {
            map.removeLayer(currentRouteLayer);
        }
        const latlngs = coordinates.map(coord => [coord[1], coord[0]]); // Inverte para [lat, lng]
        currentRouteLayer = L.polyline(latlngs, { color: 'blue', weight: 5, opacity: 0.7 }).addTo(map);
        map.fitBounds(currentRouteLayer.getBounds());
    }

    // Event Listener para buscar rota
    buscarRotaBtn.addEventListener('click', async () => {
        const origemAddress = origemInput.value;
        const destinoAddress = destinoInput.value;

        if (!origemAddress || !destinoAddress) {
            alert('Por favor, preencha os campos de origem e destino.');
            return;
        }

        // Usar a localização atual do mapa para refinar a busca de endereços
        const center = map.getCenter();
        const searchLat = center.lat;
        const searchLon = center.lng; // Corrigido de .lon para .lng

        const origemCoords = await geocodeAddress(origemAddress, searchLat, searchLon);
        const destinoCoords = await geocodeAddress(destinoAddress, searchLat, searchLon);

        if (origemCoords && destinoCoords) {
            const routeCoordinates = await fetchRoute(origemCoords, destinoCoords);
            if (routeCoordinates) {
                displayRoute(routeCoordinates);
            }
        }
    });

    // Funções de localização do usuário
    function getUserLocationAndCenterMap() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                const { latitude, longitude } = position.coords;
                const userCurrentLocation = [latitude, longitude];

                if (userLocationMarker) {
                    map.removeLayer(userLocationMarker); // Remove o marcador antigo
                }
                userLocationMarker = L.marker(userCurrentLocation)
                    .addTo(map)
                    .bindPopup('Você está aqui!')
                    .openPopup();
                map.setView(userCurrentLocation, 16);
                console.log("Localização atualizada e mapa centralizado:", userCurrentLocation);
            }, error => {
                console.error("Erro ao obter localização:", error);
                alert("Não foi possível obter sua localização. Verifique as permissões do navegador.");
                map.setView([-30.0346, -51.2177], 13); // Volta para Porto Alegre se falhar
            });
        } else {
            alert("Geolocalização não é suportada por este navegador.");
            map.setView([-30.0346, -51.2177], 13); // Volta para Porto Alegre
        }
    }

    minhaLocalizacaoBtn.addEventListener('click', getUserLocationAndCenterMap);

    // Sugestões de endereço (autocomplete)
    async function getAddressSuggestions(inputElement, suggestionsList, query) {
        if (query.length < 3) { // Começa a buscar a partir de 3 caracteres
            suggestionsList.innerHTML = '';
            suggestionsList.style.display = 'none';
            return;
        }

        const center = map.getCenter();
        const searchLat = center.lat;
        const searchLon = center.lng; // Corrigido de .lon para .lng

        try {
            const openRouteServiceUrl = `https://api.openrouteservice.org/geocode/search?api_key=${OPENROUTESERVICE_API_KEY}&text=${encodeURIComponent(query)}&boundary.country=BR&point.lat=${searchLat}&point.lon=${searchLon}`;
            const url = `${CORS_PROXY_URL}${encodeURIComponent(openRouteServiceUrl)}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            suggestionsList.innerHTML = '';
            if (data.features.length > 0) {
                data.features.forEach(feature => {
                    const li = document.createElement('li');
                    li.textContent = feature.properties.label;
                    li.addEventListener('click', () => {
                        inputElement.value = feature.properties.label;
                        suggestionsList.innerHTML = '';
                        suggestionsList.style.display = 'none';
                    });
                    suggestionsList.appendChild(li);
                });
                suggestionsList.style.display = 'block';
            } else {
                suggestionsList.style.display = 'none';
            }
        } catch (error) {
            console.error('Erro ao buscar sugestões:', error);
            suggestionsList.innerHTML = '';
            suggestionsList.style.display = 'none';
        }
    }

    origemInput.addEventListener('input', (e) => {
        getAddressSuggestions(origemInput, origemSuggestions, e.target.value);
    });

    destinoInput.addEventListener('input', (e) => {
        getAddressSuggestions(destinoInput, destinoSuggestions, e.target.value);
    });

    // Fechar sugestões ao clicar fora
    document.addEventListener('click', (e) => {
        if (!origemInput.contains(e.target) && !origemSuggestions.contains(e.target)) {
            origemSuggestions.style.display = 'none';
        }
        if (!destinoInput.contains(e.target) && !destinoSuggestions.contains(e.target)) {
            destinoSuggestions.style.display = 'none';
        }
    });

    // Avaliação de Piso (Botões)
    evaluationButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (userLocationMarker) {
                const rating = button.dataset.rating;
                const { lat, lng } = userLocationMarker.getLatLng();
                const comment = prompt(`Adicionar um comentário para a avaliação "${rating}":`);

                const newEvaluation = {
                    latitude: lat,
                    longitude: lng,
                    rating: rating,
                    timestamp: Date.now(),
                    comment: comment
                };
                const evalId = `eval-${Date.now()}`;
                evaluations[evalId] = newEvaluation;
                saveEvaluationsToLocalStorage();
                addEvaluationsToMap(evaluations); // Recarrega os marcadores no mapa
                alert(`Avaliação de piso "${rating}" salva com sucesso!`);
            } else {
                alert("Por favor, obtenha sua localização primeiro clicando em 'Minha Localização'.");
            }
        });
    });

    // Avaliação de Trecho
    iniciarAvaliacaoBtn.addEventListener('click', () => {
        if (userLocationMarker) {
            segmentEvaluationActive = true;
            segmentCoordinates = []; // Limpa coordenadas anteriores
            iniciarAvaliacaoBtn.disabled = true;
            finalizarAvaliacaoBtn.disabled = false;
            // O map.locate com watch: true já estará coletando a localização
            alert("Avaliação de trecho iniciada. Sua localização será registrada continuamente.");
        } else {
            alert("Por favor, obtenha sua localização primeiro clicando em 'Minha Localização'.");
        }
    });

    finalizarAvaliacaoBtn.addEventListener('click', () => {
        segmentEvaluationActive = false;
        iniciarAvaliacaoBtn.disabled = false;
        finalizarAvaliacaoBtn.disabled = true;

        if (currentSegmentPolyline) {
            map.removeLayer(currentSegmentPolyline);
        }

        if (segmentCoordinates.length > 1) {
            const rating = prompt("Avalie o trecho completo (Péssimo, Ruim, Regular, Bom, Ótimo):");
            if (rating && ["Péssimo", "Ruim", "Regular", "Bom", "Ótimo"].includes(rating)) {
                const comment = prompt("Adicionar um comentário para o trecho avaliado:");
                const newEvaluation = {
                    coordinates: segmentCoordinates, // Salva todas as coordenadas do trecho
                    rating: rating,
                    timestamp: Date.now(),
                    comment: comment,
                    isSegment: true // Marca como avaliação de trecho
                };
                const evalId = `segment-eval-${Date.now()}`;
                evaluations[evalId] = newEvaluation;
                saveEvaluationsToLocalStorage();
                // Opcional: Adicionar uma polilinha permanente para o trecho avaliado
                L.polyline(segmentCoordinates, { color: 'purple', weight: 6, opacity: 0.8, isEvaluationMarker: true })
                    .addTo(evaluationMarkers)
                    .bindPopup(`
                        <strong>Avaliação de Trecho:</strong> ${rating}<br>
                        <strong>Comentário:</strong> ${comment || 'N/A'}<br>
                        <strong>Pontos:</strong> ${segmentCoordinates.length}<br>
                        <strong>Data:</strong> ${new Date(newEvaluation.timestamp).toLocaleDateString()}
                    `);
                alert(`Avaliação de trecho "${rating}" salva com sucesso!`);
            } else {
                alert("Avaliação de trecho cancelada ou inválida.");
            }
        } else {
            alert("Nenhuma coordenada suficiente foi registrada para avaliar o trecho.");
        }
        segmentCoordinates = []; // Limpa para a próxima avaliação
    });

    // Função dummy para isNearRoute (ainda não implementada)
    function isNearRoute(userLocation, routeCoordinates) {
        console.log("Função isNearRoute chamada.");
        // Por enquanto, retorna true para simular a funcionalidade
        // Em uma implementação real, você verificaria a distância do usuário à rota ativa
        return true; // Supondo que o usuário está sempre perto da rota para propósitos de teste
    }

    // Função para adicionar coordenadas do segmento durante a avaliação
    function onLocationFoundForSegment(e) {
        if (segmentEvaluationActive) {
            segmentCoordinates.push([e.latlng.lat, e.latlng.lng]);
            if (currentSegmentPolyline) {
                map.removeLayer(currentSegmentPolyline);
            }
            if (segmentCoordinates.length > 1) {
                currentSegmentPolyline = L.polyline(segmentCoordinates, { color: 'purple', weight: 6, opacity: 0.8 }).addTo(map);
            }
        }
    }

    // Inicialização ao carregar a página
    evaluations = loadEvaluationsFromLocalStorage(); // Carrega avaliações (ou exemplos)
    addEvaluationsToMap(evaluations); // Adiciona ao mapa

    // Configurar o evento 'locationfound' para atualizar a localização do usuário e para o segmento
    map.on('locationfound', function(e) {
        console.log("Localização encontrada (evento map.on('locationfound')):", e.latlng);
        if (userLocationMarker) {
            userLocationMarker.setLatLng(e.latlng);
        } else {
            userLocationMarker = L.marker(e.latlng)
                .addTo(map)
                .bindPopup('Você está aqui!')
                .openPopup();
            // Centraliza o mapa na primeira vez que a localização é encontrada
            map.setView(e.latlng, 16);
        }
        // Se a avaliação de segmento estiver ativa, também adiciona a coordenada
        onLocationFoundForSegment(e);
    });

    map.on('locationerror', function(e) {
        console.error("Erro na localização do mapa (via evento):", e.message);
        alert(`Erro ao obter localização: ${e.message}. Verifique suas permissões.`);
        // Se o erro ocorrer e não houver um userLocationMarker, centralize no default
        if (!userLocationMarker) {
             map.setView([-30.0346, -51.2177], 13); // Porto Alegre
        }
    });

    // Inicia a vigilância da localização (para avaliação de trecho e marcador do usuário)
    // Isso também aciona o primeiro 'locationfound' para centralizar o mapa e adicionar o marcador
    map.locate({ watch: true, enableHighAccuracy: true, maximumAge: 10000, timeout: 60000 });
});
