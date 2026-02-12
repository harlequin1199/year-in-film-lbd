/**
 * Глобальные частоты стран производства фильмов из TMDb (в процентах от общего количества фильмов).
 * Данные получены через TMDb API discover endpoint.
 * 
 * Значения представляют долю фильмов каждой страны от общего количества фильмов в TMDb.
 * Например, United States of America составляет ~40.47% всех фильмов в TMDb.
 */
export const COUNTRY_GLOBAL_FREQUENCY = {
  'United States of America': 40.471852572230496,
  'France': 6.1985716571906915,
  'United Kingdom': 4.694432769229957,
  'Germany': 4.542928542411511,
  'Japan': 4.240008019260293,
  'Spain': 3.291413939795755,
  'India': 2.836197815455014,
  'Brazil': 2.57407703765711,
  'Canada': 2.5142843073979435,
  'Italy': 2.447808860227459,
  'China': 2.053528562459662,
  'Mexico': 1.591190068779226,
  'Russia': 1.4642184474641728,
  'South Korea': 1.2559990573851936,
  'Portugal': 0.9474509831507603,
  'Australia': 0.9296010945586858,
  'Netherlands': 0.9245890568751967,
  'Sweden': 0.9235338910470937,
  'Argentina': 0.900584034285855,
  'Philippines': 0.8199517789216557,
  'Turkey': 0.8192483350362538,
  'Poland': 0.7899674833063972,
  'Hong Kong': 0.7771296323978115,
  'Denmark': 0.6605338083924372,
  'Indonesia': 0.5850015211974022,
  'Austria': 0.5542258512110666,
  'Taiwan': 0.5494776049846033,
  'Greece': 0.5308363420214515,
  'Iran': 0.527758775022818,
  'Switzerland': 0.5095571644880423,
  'Egypt': 0.4174939459860612,
  'Hungary': 0.4025457634212697,
  'Finland': 0.3954233940815749,
  'Norway': 0.39190617465456506,
  'Belgium': 0.37862867131760314,
  'Czech Republic': 0.3773097140324745,
  'Thailand': 0.36209774001065714,
  'Ukraine': 0.3407306319915727,
  'Ireland': 0.3190118020297873,
  'Israel': 0.3097791010338866,
  'Romania': 0.24145711366422162,
  'Saudi Arabia': 0.21182453999166417,
  'New Zealand': 0.19274362460013614,
  'Chile': 0.1802574956342514,
  'Malaysia': 0.17955405174884942,
  'Colombia': 0.17111272512402595,
  'Singapore': 0.15669212547328584,
  'Peru': 0.15431800236005425,
  'Bangladesh': 0.1524714621608741,
  'Latvia': 0.14306290019362292,
  'Bulgaria': 0.137699140567433,
  'Croatia': 0.13734741862473202,
  'Iceland': 0.1362922527966291,
  'South Africa': 0.1359405308539281,
  'Serbia': 0.13013711879936196,
  'Vietnam': 0.12864230054288284,
  'Estonia': 0.125828525001275,
  'Venezuela': 0.11079241195080818,
  'Slovakia': 0.10789070592352511,
  'Kazakhstan': 0.10701140106677265,
  'Lithuania': 0.10015282318410357,
  'Slovenia': 0.09540457695764036,
  'Nigeria': 0.08168742119230221,
  'Lebanon': 0.07052024951154615,
  'Georgia': 0.07043231902587091,
  'Uruguay': 0.05891342540241387,
  'Azerbaijan': 0.0583858424883624,
  'Morocco': 0.0583858424883624,
  'Pakistan': 0.057154815688908976,
  'Cuba': 0.05398931820460017,
  'Belarus': 0.052934152376497234,
  'Puerto Rico': 0.049944515863538916,
  'Dominican Republic': 0.04941693294948746,
  'Tunisia': 0.04484454769437474,
  'Algeria': 0.04317386846654509,
  'Armenia': 0.0429980074951946,
  'Kuwait': 0.03781010884035517,
  'Iraq': 0.03763424786900468,
  'United Arab Emirates': 0.03613942961252552,
  'Sri Lanka': 0.035699777184149295,
  'Nepal': 0.03561184669847405,
  'Ecuador': 0.03552391621279881,
  'Luxembourg': 0.027434311530676308,
  'Qatar': 0.020136081219631008,
  'Bolivia': 0.020048150733955765,
  'Kenya': 0.017937819077749894,
  'Paraguay': 0.016267139849920245,
  'Jordan': 0.012574059451559975,
  'Afghanistan': 0.008968909538874947,
  'Jamaica': 0.004132732826736495,
  'Trinidad and Tobago': 0.003781010884035517,
}

/**
 * Получить глобальную частоту страны (в процентах).
 * 
 * @param {string} countryName - Название страны на английском (как в TMDb production_countries)
 * @returns {number} - Глобальная частота страны в процентах (0-100), или null если страна не найдена
 */
export function getCountryGlobalFrequency(countryName) {
  if (!countryName || typeof countryName !== 'string') return null
  const key = countryName.trim()
  // Try exact match first
  if (COUNTRY_GLOBAL_FREQUENCY[key] != null) {
    return COUNTRY_GLOBAL_FREQUENCY[key]
  }
  // Try alternative names
  if (key === 'United States' || key === 'USA') {
    return COUNTRY_GLOBAL_FREQUENCY['United States of America']
  }
  if (key === 'UK') {
    return COUNTRY_GLOBAL_FREQUENCY['United Kingdom']
  }
  if (key === 'Czechia') {
    return COUNTRY_GLOBAL_FREQUENCY['Czech Republic']
  }
  if (key === 'Russian Federation') {
    return COUNTRY_GLOBAL_FREQUENCY['Russia']
  }
  return null
}

/**
 * Создать Map с глобальными частотами стран для использования в расчётах.
 * 
 * @returns {Map<string, number>} - Map: название страны → глобальная частота (%)
 */
export function createCountryGlobalFrequencyMap() {
  const map = new Map()
  for (const [country, frequency] of Object.entries(COUNTRY_GLOBAL_FREQUENCY)) {
    map.set(country, frequency)
    // Also add alternative names
    if (country === 'United States of America') {
      map.set('United States', frequency)
      map.set('USA', frequency)
    } else if (country === 'United Kingdom') {
      map.set('UK', frequency)
    } else if (country === 'Czech Republic') {
      map.set('Czechia', frequency)
    } else if (country === 'Russia') {
      map.set('Russian Federation', frequency)
    }
  }
  return map
}
