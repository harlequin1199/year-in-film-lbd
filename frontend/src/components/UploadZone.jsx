import { useRef, useState } from 'react'

function UploadZone({ onUpload, loading }) {
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  const detectFiles = (files) => {
    if (!files || files.length === 0) return { ratings: null, diary: null }
    const list = Array.from(files).filter((f) => f.name && f.name.toLowerCase().endsWith('.csv'))
    if (list.length === 0) return { ratings: null, diary: null }
    const diary = list.find((f) => f.name.toLowerCase().includes('diary'))
    const ratings = list.find((f) => f.name.toLowerCase().includes('ratings')) || list.find((f) => !f.name.toLowerCase().includes('diary')) || list[0]
    const diaryFile = diary && diary !== ratings ? diary : null
    return { ratings, diary: diaryFile }
  }

  const handleFiles = (files) => {
    const { ratings, diary } = detectFiles(files)
    if (!ratings) return
    onUpload(ratings, diary)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragging(false)
    handleFiles(event.dataTransfer.files)
  }

  const handleInputChange = (event) => {
    handleFiles(event.target.files)
    event.target.value = ''
  }

  return (
    <div className="upload-area">
      <div
        className={`upload-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          multiple
          onChange={handleInputChange}
          hidden
        />
        <div>
          <p className="upload-title">Загрузить ratings.csv</p>
          <p className="upload-subtitle">
            Перетащите сюда или нажмите. Один файл — ratings; два файла — по имени определим diary.csv.
          </p>
        </div>
        <button className="btn" type="button" disabled={loading}>
          {loading ? 'Анализирую…' : 'Выбрать файлы'}
        </button>
      </div>
      <p className="upload-hint">Добавить diary.csv (необязательно): выберите оба файла сразу.</p>
    </div>
  )
}

export default UploadZone
