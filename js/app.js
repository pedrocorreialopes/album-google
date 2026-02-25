/**
 * Album Viewer - Google Photos Album Manager
 * Gerenciador de álbuns do Google Photos com carrossel de imagens
 */

class AlbumViewer {
    constructor() {
        this.albums = [];
        this.currentAlbum = null;
        this.currentSlide = 0;
        this.storageKey = 'albumViewer_albums';
        
        this.init();
    }

    /**
     * Inicialização da aplicação
     */
    init() {
        console.log('Album Viewer iniciando...');
        this.bindEvents();
        this.loadAlbums();
        this.setupIntersectionObserver();
        this.preloadAlbums();
        
        // Log para debug
        setTimeout(() => {
            console.log(`Total de álbuns carregados: ${this.albums.length}`);
            if (this.albums.length > 0) {
                console.log('Álbuns carregados:', this.albums.map(album => ({
                    id: album.id,
                    title: album.title,
                    photoCount: album.photoCount,
                    isPreloaded: album.isPreloaded
                })));
            }
        }, 3000);
        
        // Atalho para desenvolvimento: Ctrl+Shift+L limpa os dados
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'L') {
                e.preventDefault();
                if (confirm('Limpar todos os álbuns salvos?')) {
                    localStorage.removeItem(this.storageKey);
                    this.albums = [];
                    this.renderAlbums();
                    this.showToast('Dados limpos! Recarregue para ver os álbuns padrão.', 'info');
                }
            }
        });
    }

    /**
     * Vincula eventos aos elementos do DOM
     */
    bindEvents() {
        // Botão adicionar álbum
        const addAlbumBtn = document.getElementById('add-album-btn');
        const albumUrlInput = document.getElementById('album-url');
        
        addAlbumBtn?.addEventListener('click', () => this.addAlbum());
        albumUrlInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addAlbum();
        });

        // Modal
        const modal = document.getElementById('carousel-modal');
        const modalClose = document.querySelectorAll('[data-modal-close]');
        
        modalClose?.forEach(element => {
            element.addEventListener('click', () => this.closeModal());
        });

        // Fechar modal com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });

        // Navegação do carrossel
        const prevBtn = document.getElementById('carousel-prev');
        const nextBtn = document.getElementById('carousel-next');
        
        prevBtn?.addEventListener('click', () => this.navigateSlide(-1));
        nextBtn?.addEventListener('click', () => this.navigateSlide(1));

        // Navegação por teclado no carrossel
        document.addEventListener('keydown', (e) => {
            if (!this.isModalOpen()) return;
            
            switch(e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    this.navigateSlide(-1);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.navigateSlide(1);
                    break;
            }
        });

        // Touch/swipe support
        this.setupTouchNavigation();
    }

    /**
     * Configura observador de interseção para lazy loading
     */
    setupIntersectionObserver() {
        if ('IntersectionObserver' in window) {
            this.imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        this.loadImage(img);
                        this.imageObserver.unobserve(img);
                    }
                });
            }, {
                rootMargin: '50px 0px',
                threshold: 0.01
            });
        }
    }

    /**
     * Configura navegação por toque/swipe
     */
    setupTouchNavigation() {
        let touchStartX = 0;
        let touchEndX = 0;

        const carousel = document.querySelector('.carousel');
        
        carousel?.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        carousel?.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe(touchStartX, touchEndX);
        }, { passive: true });
    }

    /**
     * Manipula gestos de swipe
     */
    handleSwipe(startX, endX) {
        if (!this.isModalOpen()) return;
        
        const swipeThreshold = 50;
        const diff = startX - endX;

        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                this.navigateSlide(1); // Swipe left - next
            } else {
                this.navigateSlide(-1); // Swipe right - previous
            }
        }
    }

    /**
     * Pré-carrega os álbuns fornecidos
     */
    async preloadAlbums() {
        const preloadUrls = [
            'https://photos.app.goo.gl/cJ5F4g1Tou9qG49f9',
            'https://photos.app.goo.gl/7Bee33No8qgvmfCdA',
            'https://photos.app.goo.gl/vcaa1EEHVnbzJQVWA',
            'https://photos.app.goo.gl/3nUJU3k2H9wkDSXx6',
            'https://photos.app.goo.gl/87pQ4p6GTpktUK3A6',
            'https://photos.app.goo.gl/oCXm1VuaSURH3zV2A',
            'https://photos.app.goo.gl/SuB1VgMZGXNCsunt5',
            'https://photos.app.goo.gl/gBXmt8DcNLkrFMCL6'
        ];

        // Verifica se já existem álbuns carregados
        if (this.albums.length > 0) {
            return; // Não pré-carrega se já houver álbuns
        }

        this.showLoading(true, 'Inicializando álbuns compartilhados...', { loaded: 0, total: preloadUrls.length });
        
        try {
            // Tenta carregar metadados dos álbuns
            const metadataMap = this.getAlbumsMetadata();
            let loadedCount = 0;
            
            // Processa cada URL de pré-carregamento
            for (const url of preloadUrls) {
                // Verifica se já não foi adicionado
                if (this.albums.some(album => album.url === url)) {
                    continue;
                }

                try {
                    const albumId = this.extractAlbumId(url);
                    const albumData = await this.fetchAlbumData(albumId);
                    const metadata = metadataMap[url];

                    if (albumData) {
                        const newAlbum = {
                            id: albumId,
                            url: url,
                            title: metadata?.title || albumData.title || 'Álbum sem título',
                            thumbnail: metadata?.thumbnail || albumData.thumbnail || '',
                            photoCount: metadata?.photoCount || albumData.photoCount || 0,
                            photos: albumData.photos || [],
                            addedAt: new Date().toISOString(),
                            isPreloaded: true,
                            description: metadata?.description || ''
                        };

                        this.albums.push(newAlbum);
                        loadedCount++;
                        this.updateLoadingProgress(loadedCount, preloadUrls.length);
                    }
                } catch (error) {
                    console.warn(`Erro ao carregar álbum ${url}:`, error);
                    // Continua com os próximos álbuns mesmo se um falhar
                }
            }

            // Salva todos os álbuns pré-carregados
            if (this.albums.length > 0) {
                this.saveAlbums();
                this.renderAlbums();
                const loadedCount = this.albums.filter(album => album.isPreloaded).length;
                this.showToast(`${loadedCount} álbuns pré-carregados com sucesso!`, 'success');
            } else {
                // Se nenhum álbum foi carregado, mostra mensagem amigável
                this.showEmptyState(true);
                this.showToast('Nenhum álbum pôde ser carregado. Você pode adicionar manualmente.', 'info');
            }
        } catch (error) {
            console.error('Erro no pré-carregamento:', error);
            this.showToast('Alguns álbuns não puderam ser carregados', 'warning');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Retorna metadados dos álbuns pré-carregados
     */
    getAlbumsMetadata() {
        // Metadados dos álbuns para uma melhor experiência inicial
        return {
            'https://photos.app.goo.gl/cJ5F4g1Tou9qG49f9': {
                title: 'Memórias Especiais',
                thumbnail: 'https://picsum.photos/seed/memorias_especiais/400/300',
                photoCount: 24,
                description: 'Coleção de momentos especiais e lembranças'
            },
            'https://photos.app.goo.gl/7Bee33No8qgvmfCdA': {
                title: 'Paisagens & Natureza',
                thumbnail: 'https://picsum.photos/seed/paisagens_natureza/400/300',
                photoCount: 18,
                description: 'Fotos de paisagens naturais e momentos ao ar livre'
            },
            'https://photos.app.goo.gl/vcaa1EEHVnbzJQVWA': {
                title: 'Família & Amigos',
                thumbnail: 'https://picsum.photos/seed/familia_amigos/400/300',
                photoCount: 32,
                description: 'Momentos com pessoas especiais'
            },
            'https://photos.app.goo.gl/3nUJU3k2H9wkDSXx6': {
                title: 'Viagens & Aventuras',
                thumbnail: 'https://picsum.photos/seed/viagens_aventuras/400/300',
                photoCount: 28,
                description: 'Aventuras e viagens incríveis'
            },
            'https://photos.app.goo.gl/87pQ4p6GTpktUK3A6': {
                title: 'Eventos Especiais',
                thumbnail: 'https://picsum.photos/seed/eventos_especiais/400/300',
                photoCount: 21,
                description: 'Eventos e celebrações memoráveis'
            },
            'https://photos.app.goo.gl/oCXm1VuaSURH3zV2A': {
                title: 'Arte & Criatividade',
                thumbnail: 'https://picsum.photos/seed/arte_criatividade/400/300',
                photoCount: 15,
                description: 'Projetos artísticos e criativos'
            },
            'https://photos.app.goo.gl/SuB1VgMZGXNCsunt5': {
                title: 'Culinária & Gastronomia',
                thumbnail: 'https://picsum.photos/seed/culinaria_gastronomia/400/300',
                photoCount: 19,
                description: 'Experiências gastronômicas e culinárias'
            },
            'https://photos.app.goo.gl/gBXmt8DcNLkrFMCL6': {
                title: 'Estilo & Moda',
                thumbnail: 'https://picsum.photos/seed/estilo_moda/400/300',
                photoCount: 16,
                description: 'Tendências de estilo e moda'
            }
        };
    }

    /**
     * Adiciona novo álbum
     */
    async addAlbum() {
        const input = document.getElementById('album-url');
        const url = input?.value.trim();

        if (!url) {
            this.showToast('Por favor, insira um link do Google Photos', 'warning');
            return;
        }

        if (!this.isValidGooglePhotosUrl(url)) {
            this.showToast('Link inválido. Use um link do Google Photos.', 'error');
            return;
        }

        // Evita duplicatas
        if (this.albums.some(album => album.url === url)) {
            this.showToast('Este álbum já foi adicionado', 'warning');
            return;
        }

        try {
            this.showLoading(true);
            
            // Extrai ID do álbum da URL
            const albumId = this.extractAlbumId(url);
            const albumData = await this.fetchAlbumData(albumId);

            if (!albumData) {
                throw new Error('Não foi possível carregar os dados do álbum');
            }

            const newAlbum = {
                id: albumId,
                url: url,
                title: albumData.title || 'Álbum sem título',
                thumbnail: albumData.thumbnail || '',
                photoCount: albumData.photoCount || 0,
                photos: albumData.photos || [],
                addedAt: new Date().toISOString()
            };

            this.albums.push(newAlbum);
            this.saveAlbums();
            this.renderAlbums();
            
            input.value = '';
            this.showToast('Álbum adicionado com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao adicionar álbum:', error);
            this.showToast('Erro ao carregar álbum. Verifique o link.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Valida URL do Google Photos
     */
    isValidGooglePhotosUrl(url) {
        const patterns = [
            /photos\.app\.goo\.gl\//,
            /photos\.google\.com\/share\//,
            /photos\.google\.com\//
        ];
        return patterns.some(pattern => pattern.test(url));
    }

    /**
     * Extrai ID do álbum da URL
     */
    extractAlbumId(url) {
        try {
            // Para URLs do tipo photos.app.goo.gl/ABC123
            const match = url.match(/photos\.app\.goo\.gl\/([a-zA-Z0-9_-]+)/);
            if (match) return match[1];
            
            // Para URLs longas do Google Photos
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/');
            
            // Procura por um ID válido nos segmentos do path
            for (let i = pathParts.length - 1; i >= 0; i--) {
                const segment = pathParts[i];
                if (segment && segment.length > 5) {
                    return segment;
                }
            }
            
            // Se não encontrar, retorna um hash da URL
            return btoa(url).slice(0, 12);
        } catch (error) {
            console.warn('Erro ao extrair ID da URL:', error);
            return btoa(url).slice(0, 12);
        }
    }

    /**
     * Busca dados do álbum (simulação - adaptar conforme necessário)
     */
    async fetchAlbumData(albumId) {
        // Nota: Esta é uma simulação. Em produção, você precisaria:
        // 1. Usar a API do Google Photos
        // 2. Ou fazer scraping (não recomendado)
        // 3. Ou usar um serviço intermediário
        
        // Para demonstração, vamos criar dados simulados mais realistas
        return new Promise((resolve) => {
            setTimeout(() => {
                // Gera dados variados baseados no ID do álbum
                const seed = albumId.slice(0, 8);
                const photoCount = Math.floor(Math.random() * 30) + 10; // 10-40 fotos
                
                resolve({
                    title: `Álbum ${seed}`,
                    thumbnail: this.generatePlaceholderImage(400, 300, seed),
                    photoCount: photoCount,
                    photos: Array.from({ length: photoCount }, (_, i) => ({
                        id: `photo_${i}_${albumId}`,
                        url: this.generatePlaceholderImage(1200, 800, `${seed}_${i}`),
                        thumbnail: this.generatePlaceholderImage(400, 300, `${seed}_${i}`),
                        title: `Foto ${i + 1} do álbum`
                    }))
                });
            }, 500 + Math.random() * 1000); // Delay aleatório entre 0.5-1.5s
        });
    }

    /**
     * Gera imagem placeholder para demonstração
     */
    generatePlaceholderImage(width, height, text) {
        // Usa o serviço picsum.photos para imagens reais
        const seed = encodeURIComponent(text);
        return `https://picsum.photos/seed/${seed}/${width}/${height}`;
    }

    /**
     * Carrega álbuns do armazenamento local
     */
    loadAlbums() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                this.albums = JSON.parse(stored);
                this.renderAlbums();
            } else {
                this.showEmptyState(true);
            }
        } catch (error) {
            console.error('Erro ao carregar álbuns:', error);
            this.showEmptyState(true);
        }
    }

    /**
     * Salva álbuns no armazenamento local
     */
    saveAlbums() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.albums));
        } catch (error) {
            console.error('Erro ao salvar álbuns:', error);
        }
    }

    /**
     * Renderiza álbuns na interface
     */
    renderAlbums() {
        const container = document.getElementById('albums-container');
        const emptyState = document.getElementById('empty-state');
        
        if (!container) return;

        if (this.albums.length === 0) {
            this.showEmptyState(true);
            return;
        }

        this.showEmptyState(false);
        
        container.innerHTML = this.albums.map(album => `
            <article class="album-card" data-album-id="${album.id}" role="button" tabindex="0" aria-label="Abrir álbum: ${album.title}">
                <img 
                    src="${album.thumbnail}" 
                    alt="Capa do álbum: ${album.title}"
                    class="album-card__image"
                    loading="lazy"
                >
                <div class="album-card__content">
                    <h3 class="album-card__title" title="${album.title}">${album.title}</h3>
                    <p class="album-card__count">
                        <i class="fas fa-camera" aria-hidden="true"></i>
                        ${album.photoCount} fotos
                    </p>
                </div>
            </article>
        `).join('');

        // Adiciona eventos de clique nos cards
        container.querySelectorAll('.album-card').forEach(card => {
            card.addEventListener('click', () => {
                const albumId = card.dataset.albumId;
                this.openAlbum(albumId);
            });

            // Acessibilidade: Enter/Space para abrir
            card.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const albumId = card.dataset.albumId;
                    this.openAlbum(albumId);
                }
            });
        });
    }

    /**
     * Abre álbum no carrossel
     */
    openAlbum(albumId) {
        const album = this.albums.find(a => a.id === albumId);
        if (!album || !album.photos.length) {
            this.showToast('Álbum vazio ou não encontrado', 'warning');
            return;
        }

        this.currentAlbum = album;
        this.currentSlide = 0;
        this.openModal();
        this.renderCarousel();
    }

    /**
     * Renderiza carrossel com fotos
     */
    renderCarousel() {
        if (!this.currentAlbum) return;

        const track = document.getElementById('carousel-track');
        const indicators = document.getElementById('carousel-indicators');
        const modalTitle = document.getElementById('carousel-title');
        
        if (!track || !indicators || !modalTitle) return;

        modalTitle.textContent = this.currentAlbum.title;

        // Renderiza slides
        track.innerHTML = this.currentAlbum.photos.map((photo, index) => `
            <div class="carousel__slide" role="tabpanel" id="slide-${index}" aria-label="Foto ${index + 1} de ${this.currentAlbum.photos.length}">
                <img 
                    src="${photo.url}" 
                    alt="${photo.title || `Foto ${index + 1}`}"
                    class="carousel__image"
                    loading="lazy"
                >
            </div>
        `).join('');

        // Renderiza indicadores
        indicators.innerHTML = this.currentAlbum.photos.map((_, index) => `
            <button 
                class="carousel__indicator ${index === 0 ? 'carousel__indicator--active' : ''}"
                role="tab"
                aria-label="Ir para foto ${index + 1}"
                data-slide="${index}"
            ></button>
        `).join('');

        // Adiciona eventos aos indicadores
        indicators.querySelectorAll('.carousel__indicator').forEach(indicator => {
            indicator.addEventListener('click', () => {
                const slideIndex = parseInt(indicator.dataset.slide);
                this.goToSlide(slideIndex);
            });
        });

        this.updateCarouselPosition();
    }

    /**
     * Navega entre slides
     */
    navigateSlide(direction) {
        if (!this.currentAlbum) return;
        
        const totalSlides = this.currentAlbum.photos.length;
        this.currentSlide = (this.currentSlide + direction + totalSlides) % totalSlides;
        this.updateCarouselPosition();
    }

    /**
     * Vai para slide específico
     */
    goToSlide(index) {
        if (!this.currentAlbum || index < 0 || index >= this.currentAlbum.photos.length) return;
        
        this.currentSlide = index;
        this.updateCarouselPosition();
    }

    /**
     * Atualiza posição do carrossel
     */
    updateCarouselPosition() {
        const track = document.getElementById('carousel-track');
        const indicators = document.querySelectorAll('.carousel__indicator');
        
        if (!track) return;

        const translateX = -this.currentSlide * 100;
        track.style.transform = `translateX(${translateX}%)`;

        // Atualiza indicadores
        indicators.forEach((indicator, index) => {
            indicator.classList.toggle('carousel__indicator--active', index === this.currentSlide);
        });

        // Atualiza ARIA
        const slides = document.querySelectorAll('.carousel__slide');
        slides.forEach((slide, index) => {
            slide.setAttribute('aria-hidden', index !== this.currentSlide);
        });
    }

    /**
     * Abre modal do carrossel
     */
    openModal() {
        const modal = document.getElementById('carousel-modal');
        if (!modal) return;

        modal.classList.add('modal--active');
        modal.setAttribute('aria-hidden', 'false');
        
        // Previne scroll do body
        document.body.style.overflow = 'hidden';
        
        // Foca no primeiro elemento interativo
        setTimeout(() => {
            const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            firstFocusable?.focus();
        }, 100);
    }

    /**
     * Fecha modal do carrossel
     */
    closeModal() {
        const modal = document.getElementById('carousel-modal');
        if (!modal) return;

        modal.classList.remove('modal--active');
        modal.setAttribute('aria-hidden', 'true');
        
        // Restaura scroll do body
        document.body.style.overflow = '';
        
        this.currentAlbum = null;
        this.currentSlide = 0;
    }

    /**
     * Verifica se modal está aberto
     */
    isModalOpen() {
        const modal = document.getElementById('carousel-modal');
        return modal?.classList.contains('modal--active') || false;
    }

    /**
     * Carrega imagem com lazy loading
     */
    loadImage(img) {
        if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            img.classList.add('loaded');
        }
    }

    /**
     * Mostra/esconde estado de carregamento
     */
    showLoading(show, message = 'Carregando álbuns compartilhados...', progress = null) {
        const loading = document.getElementById('loading');
        const loadingText = loading?.querySelector('.loading__text');
        const loadingProgress = document.getElementById('loading-progress');
        
        if (loading) {
            loading.setAttribute('aria-hidden', !show);
        }
        
        if (loadingText) {
            loadingText.textContent = message;
        }
        
        if (loadingProgress) {
            loadingProgress.style.display = progress ? 'block' : 'none';
        }
    }

    /**
     * Atualiza progresso de carregamento
     */
    updateLoadingProgress(loaded, total) {
        const loadedCount = document.getElementById('loaded-count');
        const totalCount = document.getElementById('total-count');
        const loadingProgress = document.getElementById('loading-progress');
        
        if (loadedCount) loadedCount.textContent = loaded;
        if (totalCount) totalCount.textContent = total;
        if (loadingProgress) loadingProgress.style.display = 'block';
        
        // Atualiza mensagem de loading
        const loadingText = document.querySelector('.loading__text');
        if (loadingText && loaded > 0) {
            loadingText.textContent = `Carregando álbum ${loaded} de ${total}...`;
        }
    }

    /**
     * Mostra/esconde estado vazio
     */
    showEmptyState(show) {
        const emptyState = document.getElementById('empty-state');
        const albumsContainer = document.getElementById('albums-container');
        
        if (emptyState) emptyState.setAttribute('aria-hidden', !show);
        if (albumsContainer) albumsContainer.style.display = show ? 'none' : 'grid';
    }

    /**
     * Mostra notificação toast
     */
    showToast(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.setAttribute('role', 'alert');
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        toast.innerHTML = `
            <i class="fas ${icons[type]} toast__icon" aria-hidden="true"></i>
            <div class="toast__content">
                <p class="toast__message">${message}</p>
            </div>
            <button class="toast__close" aria-label="Fechar notificação">
                <i class="fas fa-times" aria-hidden="true"></i>
            </button>
        `;

        container.appendChild(toast);

        // Remove após o tempo especificado
        setTimeout(() => {
            toast.remove();
        }, duration);

        // Evento de fechar
        toast.querySelector('.toast__close')?.addEventListener('click', () => {
            toast.remove();
        });
    }
}

/**
 * Inicialização quando DOM estiver pronto
 */
document.addEventListener('DOMContentLoaded', () => {
    new AlbumViewer();
});

/**
 * Service Worker para funcionalidade offline (opcional)
 */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}