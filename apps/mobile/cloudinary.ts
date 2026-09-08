const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME
const uploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET

export async function uploadMobileTournamentImage(uri: string, mimeType = 'image/jpeg') {
  if (!cloudName || !uploadPreset) throw new Error('Image uploads are not configured. Add the Cloudinary values to apps/mobile/.env.local.')
  const blob = await (await fetch(uri)).blob()
  if (blob.size > 5 * 1024 * 1024) throw new Error('Choose an image smaller than 5 MB.')
  const formData = new FormData()
  formData.append('file', { uri, type: mimeType, name: 'tournament-image.jpg' } as unknown as Blob)
  formData.append('upload_preset', uploadPreset)
  formData.append('folder', 'brackify/tournaments')
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: formData })
  const result = await response.json() as { secure_url?: string; error?: { message?: string } }
  if (!response.ok || !result.secure_url) throw new Error(result.error?.message || 'Image upload failed.')
  return result.secure_url
}
