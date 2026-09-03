const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

export async function uploadTournamentImage(file: File) {
  if (!cloudName || !uploadPreset) throw new Error('Image uploads are not configured. Add the Cloudinary Vite variables to apps/web/.env.local.')
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Choose an image smaller than 5 MB.')

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)
  formData.append('folder', 'brackify/tournaments')

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: formData })
  const result = await response.json() as { secure_url?: string; error?: { message?: string } }
  if (!response.ok || !result.secure_url) throw new Error(result.error?.message || 'Image upload failed. Please try again.')
  return result.secure_url
}
