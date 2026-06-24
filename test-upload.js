const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

(async () => {
  try {
    const imagePath = './public/images/gallery/cosmopolitan/cosmopolitan.png';
    const form = new FormData();
    form.append('image', fs.createReadStream(imagePath));
    form.append('alt', 'Teste Upload Automático');
    form.append('title', 'Teste');

    const response = await axios.post('http://localhost:3000/admin/upload-gallery/cosmopolitan', form, {
      headers: form.getHeaders()
    });

    console.log('Upload Success:', response.status, response.data);
  } catch (error) {
    console.error('Upload Error:', error.response?.status, error.response?.data || error.message);
  }
})();
