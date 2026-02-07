import { useRef, useState } from 'react'

// Broad accept for mobile (iOS/Android often use different MIME types for CSV)
const FILE_ACCEPT = '.csv,text/csv,application/csv,text/plain,application/vnd.ms-excel'

function UploadZone({ onUpload, loading }) {
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [selectError, setSelectError] = useState(null)

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
    setSelectError(null)
    if (!files || files.length === 0) return
    const { ratings, diary } = detectFiles(files)
    if (!ratings) {
      setSelectError('Выберите файл с расширением .csv')
      return
    }
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
          accept={FILE_ACCEPT}
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
      {selectError && <p className="upload-error">{selectError}</p>}
      <p className="upload-hint">Добавить diary.csv (необязательно): выберите оба файла сразу.</p>
    </div>
  )
}

export default UploadZone
