export const API_URL = '';

export async function api(url, method = "GET", data = null) {
    const options = {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include"
    };

    if (data !== null) {
        options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const result = await response.json();

    if (!response.ok) throw new Error(result.message || "Erro de API");
    return result;
}

export async function fetchData(resource) {
    return api(`${API_URL}/api/${resource}`, "GET");
}

export async function fetchItemById(resource, id) {
    return api(`${API_URL}/api/${resource}/${id}`, "GET");
}

export async function handleFileUpload(inputEl) {
    if (!inputEl || !inputEl.files || inputEl.files.length === 0) {
        throw new Error("Nenhum ficheiro selecionado");
    }
    const formData = new FormData();
    formData.append('file', inputEl.files[0]);

    const res = await fetch(`${API_URL}/api/upload/`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Erro ao fazer upload');
    return result.fileUrl;
}
