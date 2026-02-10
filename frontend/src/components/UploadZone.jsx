import { useRef, useState } from 'react'

// Broad accept for mobile (iOS/Android often use different MIME types for CSV)
const FILE_ACCEPT = '.csv,text/csv,application/csv,text/plain,application/vnd.ms-excel'

function UploadZone({ onUpload, loading, selectedFileName = '', selectedFilmCount = 0 }) {
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [selectError, setSelectError] = useState(null)
  const hasFile = Boolean(selectedFileName)

  const handleFiles = (files) => {
    setSelectError(null)
    if (!files || files.length === 0) return
    const list = Array.from(files).filter((f) => f.name && f.name.toLowerCase().endsWith('.csv'))
    const ratingsFile = list[0] || null
    if (!ratingsFile) {
      setSelectError('Выберите файл с расширением .csv')
      return
    }
    onUpload(ratingsFile)
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
        className={`upload-zone ${isDragging ? 'dragging' : ''} ${hasFile ? 'has-file' : ''}`}
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
          onChange={handleInputChange}
          hidden
        />
        <div>
          <p className="upload-title">Загрузить ratings.csv</p>
          <p className="upload-subtitle">
            Перетащите сюда или нажмите, чтобы выбрать файл.
          </p>
        </div>
        <button className="btn" type="button" disabled={loading}>
          {loading ? 'Анализирую…' : 'Выбрать файл'}
        </button>
        {hasFile && (
          <p className="upload-file-state">
            Выбран файл: <strong>{selectedFileName}</strong>
            {selectedFilmCount > 0 && (
              <> ({selectedFilmCount} {selectedFilmCount === 1 ? 'фильм' : selectedFilmCount < 5 ? 'фильма' : 'фильмов'})</>
            )}
          </p>
        )}
      </div>
      {selectError && <p className="upload-error">{selectError}</p>}
    </div>
  )
}

export default UploadZone
