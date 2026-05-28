// admin-scripts.js - Funções utilitárias compartilhadas

// Variável global para projectId (definida nas páginas que usam este script)
const projectId = window.projectId || '';

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
                    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
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
