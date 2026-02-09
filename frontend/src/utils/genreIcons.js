/**
 * Иконки и цвета для жанров
 * Используются иконки с icons8.ru в стиле iOS 7 (outlined)
 */

const genreIcons = {
  Action: { 
    iconUrl: 'https://img.icons8.com/ios7/1200/explosion.png',
    iconName: 'explosion',
    fallback: '💥',
    color: '#FF6B6B', // Мягкий красный
    bgColor: '#3A2525' // Мягкий тёмно-красный фон
  },
  Adventure: { 
    iconUrl: 'https://img.icons8.com/ios7/1200/adventure.png',
    iconName: 'adventure',
    fallback: '🗺️',
    color: '#51CF66', // Мягкий зелёный
    bgColor: '#1F3321' // Мягкий тёмно-зелёный фон
  },
  Animation: { 
    iconUrl: 'https://img.icons8.com/ios7/1200/movie.png',
    iconName: 'movie',
    fallback: '🎬',
    color: '#FFA94D', // Мягкий оранжевый
    bgColor: '#3A2E1F' // Мягкий тёмно-оранжевый фон
  },
  Comedy: { 
    iconUrl: 'https://img.icons8.com/ios7/1200/comedy.png',
    iconName: 'comedy',
    fallback: '😂',
    color: '#FFD43B', // Мягкий жёлтый
    bgColor: '#3A3520' // Мягкий тёмно-жёлтый фон
  },
  Crime: { 
    iconUrl: 'https://img.icons8.com/ios7/1200/pistol.png',
    iconName: 'pistol',
    fallback: '🔫',
    color: '#B197FC', // Мягкий фиолетовый
    bgColor: '#2E2538' // Мягкий тёмно-фиолетовый фон
  },
  Documentary: { 
    iconUrl: 'https://img.icons8.com/ios7/1200/video-camera.png',
    iconName: 'video-camera',
    fallback: '📹',
    color: '#74C0FC', // Мягкий сине-серый
    bgColor: '#252A2E' // Мягкий тёмно-серый фон
  },
  Drama: { 
    iconUrl: 'https://img.icons8.com/ios7/1200/theater-masks.png',
    iconName: 'theater-masks',
    fallback: '🎭',
    color: '#4DABF7', // Мягкий синий
    bgColor: '#1E2A35' // Мягкий тёмно-синий фон
  },
  Family: { 
    iconUrl: 'https://img.icons8.com/ios7/1200/family.png',
    iconName: 'family',
    fallback: '👨‍👩‍👧‍👦',
    color: '#F783AC', // Мягкий розовый
    bgColor: '#35242A' // Мягкий тёмно-розовый фон
  },
  Fantasy: { 
    iconUrl: 'https://img.icons8.com/ios7/1200/magic-wand.png',
    iconName: 'magic-wand',
    fallback: '✨',
    color: '#B197FC', // Мягкий фиолетовый
    bgColor: '#2E2538' // Мягкий тёмно-фиолетовый фон
  },
  History: { 
    iconUrl: 'https://img.icons8.com/ios7/1200/scroll.png',
    iconName: 'scroll',
    fallback: '📜',
    color: '#A9A29C', // Мягкий коричневый
    bgColor: '#2E2A27' // Мягкий тёмно-коричневый фон
  },
  Horror: { 
    iconUrl: 'https://img.icons8.com/ios7/1200/ghost.png',
    iconName: 'ghost',
    fallback: '👻',
    color: '#FF8787', // Мягкий тёмно-красный
    bgColor: '#3A2525' // Мягкий тёмно-красный фон
  },
  Music: { 
    iconUrl: 'https://img.icons8.com/ios7/1200/musical-notes.png',
    iconName: 'musical-notes',
    fallback: '🎵',
    color: '#F783AC', // Мягкий розовый
    bgColor: '#35242A' // Мягкий тёмно-розовый фон
  },
  Mystery: { 
    iconUrl: 'https://img.icons8.com/ios7/1200/search.png',
    iconName: 'search',
    fallback: '🔍',
    color: '#9775FA', // Мягкий тёмно-фиолетовый
    bgColor: '#2A2235' // Мягкий тёмно-фиолетовый фон
  },
  Romance: { 
    iconUrl: 'https://img.icons8.com/ios7/1200/heart.png',
    iconName: 'heart',
    fallback: '💕',
    color: '#F783AC', // Мягкий розовый
    bgColor: '#35242A' // Мягкий тёмно-розовый фон
  },
  'Science Fiction': { 
    iconUrl: 'https://img.icons8.com/ios7/1200/rocket.png',
    iconName: 'rocket',
    fallback: '🚀',
    color: '#3BC9DB', // Мягкий голубой
    bgColor: '#1E2D30' // Мягкий тёмно-голубой фон
  },
  'TV Movie': { 
    iconUrl: 'https://img.icons8.com/ios7/1200/tv.png',
    iconName: 'tv',
    fallback: '📺',
    color: '#74C0FC', // Мягкий сине-серый
    bgColor: '#252A2E' // Мягкий тёмно-серый фон
  },
  Thriller: { 
    iconUrl: 'https://img.icons8.com/ios7/1200/knife.png',
    iconName: 'knife',
    fallback: '🔪',
    color: '#E03131', // Мягкий тёмно-красный
    bgColor: '#3A2525' // Мягкий тёмно-красный фон
  },
  War: { 
    iconUrl: 'https://img.icons8.com/ios7/1200/sword.png',
    iconName: 'sword',
    fallback: '⚔️',
    color: '#8B6F47', // Мягкий коричневый
    bgColor: '#2E2A27' // Мягкий тёмно-коричневый фон
  },
  Western: { 
    iconUrl: 'https://img.icons8.com/ios7/1200/cowboy-hat.png',
    iconName: 'cowboy-hat',
    fallback: '🤠',
    color: '#A9A29C', // Мягкий коричневый
    bgColor: '#2E2A27' // Мягкий тёмно-коричневый фон
  },
}

/**
 * Получить иконку и цвет для жанра
 * @param {string} genreName - название жанра (обычно на английском из TMDB)
 * @returns {{iconUrl: string, fallback: string, color: string}} - объект с URL иконки, fallback эмодзи и цветом
 */
export function getGenreIcon(genreName) {
  if (!genreName || typeof genreName !== 'string') {
    return { 
      iconUrl: 'https://img.icons8.com/ios7/1200/movie.png',
      fallback: '🎬',
      color: '#93a0b5',
      bgColor: '#252A2E'
    }
  }
  const key = genreName.trim()
  return genreIcons[key] || { 
    iconUrl: 'https://img.icons8.com/ios7/1200/movie.png',
    fallback: '🎬',
    color: '#93a0b5',
    bgColor: '#252A2E'
  }
}
