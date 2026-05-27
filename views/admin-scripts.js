// admin-scripts.js

/**
 * Configura a funcionalidade de Drag and Drop para uma área de upload.
 * @param {HTMLElement} dropArea O elemento HTML que serve como área de drop.
 * @param {HTMLInputElement} fileInput O input de arquivo associado.
 * @param {Array<File>} selectedFiles Array para armazenar os arquivos selecionados.
 * @param {HTMLElement} previewContainer O container para exibir os previews.
 * @param {HTMLElement} uploadButton O botão de upload.
 */
function setupDragAndDrop(dropArea, fileInput, selectedFiles, previewContainer, uploadButton) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.add('highlight'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.remove('highlight'), false);
    });

    dropArea.addEventListener('drop', handleDrop, false);
    dropArea.addEventListener('click', () => fileInput.click(), false);

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFileSelection(files, selectedFiles, previewContainer, uploadButton);
    }
}

/**
 * Lida com a seleção de arquivos (seja por input ou drag/drop).
 * @param {FileList} files Lista de arquivos selecionados.
 * @param {Array<File>} selectedFiles Array para armazenar os arquivos.
 * @param {HTMLElement} previewContainer O container para exibir os previews.
 * @param {HTMLElement} uploadButton O botão de upload.
 */
function handleFileSelection(files, selectedFiles, previewContainer, uploadButton) {
    for (const file of files) {
        selectedFiles.push(file);
        displayFilePreview(file, previewContainer);
    }
    if (selectedFiles.length > 0) {
        uploadButton.style.display = 'block';
    }
}

/**
 * Exibe um preview de um arquivo de imagem.
 * @param {File} file O arquivo de imagem.
 * @param {HTMLElement} previewContainer O container para exibir o preview.
 */
function displayFilePreview(file, previewContainer) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = function() {
        const previewItem = document.createElement('div');
        previewItem.classList.add('upload-preview-item');
        previewItem.innerHTML = `
            <img src="${reader.result}" alt="${file.name}">
            <div class="file-info">
                <span class="file-name">${file.name}</span>
                <span class="file-size">(${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
            </div>
            <div class="file-metadata">
                <input type="text" class="form-control-inline" placeholder="Texto Alt (obrigatório)" data-file-name="${file.name}" required>
                <input type="text" class="form-control-inline" placeholder="Título (opcional)" data-file-name="${file.name}">
            </div>
        `;
        previewContainer.appendChild(previewItem);
    };
}

/**
 * Realiza o upload de arquivos para o servidor.
 * @param {Array<File>} filesToUpload Array de arquivos a serem enviados.
 * @param {string} uploadUrl URL para onde os arquivos serão enviados.
 * @param {HTMLElement} progressBarContainer Container da barra de progresso.
 * @param {HTMLElement} progressBar Elemento da barra de progresso.
 * @param {HTMLElement} progressText Elemento de texto do progresso.
 * @param {HTMLElement} messagesContainer Container para mensagens de feedback.
 * @param {HTMLElement} galleryContainer Container da galeria para adicionar imagens dinamicamente.
 * @param {HTMLElement} noImagesMessage Elemento de mensagem "nenhuma imagem".
 * @param {Function} callback Callback a ser executado após o upload.
 */
async function uploadFiles(filesToUpload, uploadUrl, progressBarContainer, progressBar, progressText, messagesContainer, galleryContainer, noImagesMessage, callback) {
    if (filesToUpload.length === 0) {
        Swal.fire('Atenção', 'Nenhum arquivo selecionado para upload.', 'warning');
        return;
    }

    progressBarContainer.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    messagesContainer.innerHTML = '';

    let uploadedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const formData = new FormData();
        formData.append('image', file);

        // Coleta metadados dos inputs de preview
        const altInput = document.querySelector(`.upload-preview-item input[data-file-name="${file.name}"][placeholder="Texto Alt (obrigatório)"]`);
        const titleInput = document.querySelector(`.upload-preview-item input[data-file-name="${file.name}"][placeholder="Título (opcional)"]`);

        if (!altInput || !altInput.value.trim()) {
            messagesContainer.innerHTML += `<p class="text-danger">✕ Erro: Texto Alt é obrigatório para ${file.name}</p>`;
            errorCount++;
            continue;
        }

        formData.append('alt', altInput.value.trim());
        if (titleInput && titleInput.value.trim()) {
            formData.append('title', titleInput.value.trim());
        }

        try {
            const response = await fetch(uploadUrl, {
                method: 'POST',
                body: formData,
                // onUploadProgress: (progressEvent) => { // Axios tem isso, fetch não nativamente
                //     const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                //     progressBar.style.width = `${percentCompleted}%`;
                //     progressText.textContent = `${percentCompleted}%`;
                // }
            });

            const result = await response.json();

            if (result.success) {
                messagesContainer.innerHTML += `<p class="text-success">✓ ${file.name} carregado com sucesso!</p>`;
                uploadedCount++;
                // Adiciona a imagem à galeria dinamicamente
                if (galleryContainer && result.image) {
                    if (noImagesMessage) noImagesMessage.style.display = 'none';
                    const newItem = document.createElement('div');
                    newItem.classList.add('image-gallery-item');
                    newItem.setAttribute('data-filename', result.image.src.split('/').pop());
                    newItem.innerHTML = `
                        <img src="${result.image.src}" alt="${result.image.alt}" title="${result.image.title}">
                        <div class="image-actions">
                            <button class="btn btn-danger btn-sm" onclick="confirmDeleteImage('${projectId}', '${result.image.src.split('/').pop()}', '${uploadUrl.includes('/upload-planta/') ? 'planta' : 'gallery'}')"><i class="fas fa-trash"></i></button>
                        </div>
                        <p class="image-alt-text">${result.image.alt}</p>
                    `;
                    galleryContainer.appendChild(newItem);
                }
            } else {
                messagesContainer.innerHTML += `<p class="text-danger">✕ Erro ao carregar ${file.name}: ${result.message}</p>`;
                errorCount++;
            }
        } catch (error) {
            messagesContainer.innerHTML += `<p class="text-danger">✕ Erro de rede ao carregar ${file.name}: ${error.message}</p>`;
            errorCount++;
        } finally {
            // Atualiza a barra de progresso geral (simulada se não houver onUploadProgress)
            const overallProgress = Math.round(((uploadedCount + errorCount) / filesToUpload.length) * 100);
            progressBar.style.width = `${overallProgress}%`;
            progressText.textContent = `${overallProgress}%`;
        }
    }

    progressBarContainer.style.display = 'none';
    Swal.fire('Upload Concluído', `Total de arquivos: ${filesToUpload.length}<br>Sucesso: ${uploadedCount}<br>Erros: ${errorCount}`, (errorCount > 0 ? 'error' : 'success'));
    callback();
}

/**
 * Exibe um modal de confirmação para deletar uma imagem.
 * @param {string} projectId ID do projeto.
 * @param {string} filename Nome do arquivo a ser deletado.
 * @param {'planta' | 'gallery'} type Tipo de galeria (planta ou geral).
 */
function confirmDeleteImage(projectId, filename, type) {
    Swal.fire({
        title: 'Tem certeza?',
        text: "Você não poderá reverter isso! A imagem será removida do servidor e da galeria.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sim, deletar!',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const deleteUrl = type === 'planta' ? `/admin/delete-planta-image/${projectId}/${filename}` : `/admin/delete-gallery-image/${projectId}/${filename}`;
                const response = await fetch(deleteUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data = await response.json();

                if (data.success) {
                    Swal.fire('Deletado!', data.message, 'success');
                    // Remove a imagem da UI
                    const itemToRemove = document.querySelector(`.image-gallery-item[data-filename="${filename}"]`);
                    if (itemToRemove) {
                        itemToRemove.remove();
                    }
                    // Verifica se a galeria ficou vazia
                    const galleryContainer = type === 'planta' ? document.getElementById('plantaImageGallery') : document.getElementById('projectGalleryImages');
                    const noImagesMessage = type === 'planta' ? document.getElementById('noPlantaImagesMessage') : document.getElementById('noProjectGalleryImagesMessage');
                    if (galleryContainer && galleryContainer.children.length === 0 && noImagesMessage) {
                        noImagesMessage.style.display = 'block';
                    }
                } else {
                    Swal.fire('Erro!', data.message, 'error');
                }
            } catch (error) {
                console.error('Erro ao deletar imagem:', error);
                Swal.fire('Erro!', 'Erro de conexão ou servidor.', 'error');
            }
        }
    });
}

/**
 * Exibe um modal de confirmação para deletar um projeto.
 * @param {string} projectId ID do projeto.
 * @param {string} itemType Tipo do item (ex: 'projeto').
 * @param {string} deleteUrl URL para a requisição de deleção.
 */
function showConfirmDeleteModal(projectId, itemType, deleteUrl) {
    Swal.fire({
        title: 'Tem certeza?',
        html: `Você realmente deseja deletar este ${itemType} (ID: <strong>${projectId}</strong>)?<br>Esta ação é irreversível e removerá todos os dados e imagens associadas.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sim, deletar!',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const response = await fetch(deleteUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data = await response.json();
                if (data.success) {
                    Swal.fire('Deletado!', data.message, 'success').then(() => {
                        location.reload(); // Recarrega a página para atualizar a lista
                    });
                } else {
                    Swal.fire('Erro!', data.message, 'error');
                }
            } catch (error) {
                console.error(`Erro ao deletar ${itemType}:`, error);
                Swal.fire('Erro!', 'Erro de conexão ou servidor.', 'error');
            }
        }
    });
}