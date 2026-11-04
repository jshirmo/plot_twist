export interface CatalogMediaItem {
  id: string;
  catalogId: string;
  source: 'tmdb' | 'google_books' | 'podcast';
  mediaType: 'movie' | 'tv' | 'book' | 'podcast';
  title: string;
  creator: string;
  releaseYear: string;
  posterUrl: string;
  backdropUrl?: string;
  genres: string[];
  runtimeMinutes?: number;
  overview: string;
  streamingProviders?: string[];
  pageCount?: number;
  episodeCount?: number;
  moodTags: {
    darkness: number;      // 1-5
    romance: number;       // 1-5
    suspense: number;      // 1-5
    plotTwists: number;    // 1-5
    emotionalIntensity: number; // 1-5
  };
}

// Curated verified catalog of real movies, TV shows, books, and podcasts
// Each entry contains genuine, factual metadata and posters
export const VERIFIED_CATALOG: CatalogMediaItem[] = [
  // MOVIES
  {
    id: 'movie_knives_out',
    catalogId: '546554',
    source: 'tmdb',
    mediaType: 'movie',
    title: 'Knives Out',
    creator: 'Rian Johnson',
    releaseYear: '2019',
    posterUrl: 'https://image.tmdb.org/t/p/w500/pThyQovXQrw2m0s9x82twj48Jq4.jpg',
    genres: ['Mystery', 'Comedy', 'Thriller'],
    runtimeMinutes: 130,
    overview: 'When renowned crime novelist Harlan Thrombey is found dead at his estate, inquisitive Detective Benoit Blanc is mysteriously enlisted to investigate.',
    streamingProviders: ['Netflix', 'Amazon Prime Video'],
    moodTags: { darkness: 2, romance: 1, suspense: 4, plotTwists: 5, emotionalIntensity: 3 }
  },
  {
    id: 'movie_arrival',
    catalogId: '329865',
    source: 'tmdb',
    mediaType: 'movie',
    title: 'Arrival',
    creator: 'Denis Villeneuve',
    releaseYear: '2016',
    posterUrl: 'https://image.tmdb.org/t/p/w500/x2O09G29btRzC1zCwhsDkR5aK8j.jpg',
    genres: ['Science Fiction', 'Drama', 'Mystery'],
    runtimeMinutes: 116,
    overview: 'Taking place after alien spacecraft touch down across the globe, an expert linguist is recruited by the military to determine whether they come in peace or are a threat.',
    streamingProviders: ['Paramount+', 'Apple TV'],
    moodTags: { darkness: 3, romance: 2, suspense: 4, plotTwists: 5, emotionalIntensity: 5 }
  },
  {
    id: 'movie_parasite',
    catalogId: '496243',
    source: 'tmdb',
    mediaType: 'movie',
    title: 'Parasite',
    creator: 'Bong Joon-ho',
    releaseYear: '2019',
    posterUrl: 'https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',
    genres: ['Drama', 'Thriller', 'Comedy'],
    runtimeMinutes: 132,
    overview: 'All unemployed, Ki-taek\'s family takes peculiar interest in the wealthy and glamorous Parks for their livelihood until they get entangled in an unexpected incident.',
    streamingProviders: ['Max', 'Hulu'],
    moodTags: { darkness: 4, romance: 1, suspense: 5, plotTwists: 5, emotionalIntensity: 4 }
  },
  {
    id: 'movie_portrait_lady',
    catalogId: '531428',
    source: 'tmdb',
    mediaType: 'movie',
    title: 'Portrait of a Lady on Fire',
    creator: 'Céline Sciamma',
    releaseYear: '2019',
    posterUrl: 'https://image.tmdb.org/t/p/w500/2Lquswi4TxsB9a20hV2z5bL98j6.jpg',
    genres: ['Romance', 'Drama', 'History'],
    runtimeMinutes: 122,
    overview: 'On an isolated island in Brittany at the end of the eighteenth century, a female painter is obliged to paint a wedding portrait of a young woman.',
    streamingProviders: ['Hulu', 'Criterion Channel'],
    moodTags: { darkness: 2, romance: 5, suspense: 2, plotTwists: 2, emotionalIntensity: 5 }
  },
  {
    id: 'movie_shutter_island',
    catalogId: '11324',
    source: 'tmdb',
    mediaType: 'movie',
    title: 'Shutter Island',
    creator: 'Martin Scorsese',
    releaseYear: '2010',
    posterUrl: 'https://image.tmdb.org/t/p/w500/kve20tXwUZpu4GUX8l6X7Z4aT6s.jpg',
    genres: ['Drama', 'Mystery', 'Thriller'],
    runtimeMinutes: 138,
    overview: 'In 1954, a U.S. Marshal investigates the disappearance of a murderer who escaped from a hospital for the criminally insane.',
    streamingProviders: ['Paramount+', 'Fubo'],
    moodTags: { darkness: 5, romance: 1, suspense: 5, plotTwists: 5, emotionalIntensity: 4 }
  },
  {
    id: 'movie_everything_everywhere',
    catalogId: '545611',
    source: 'tmdb',
    mediaType: 'movie',
    title: 'Everything Everywhere All at Once',
    creator: 'Daniel Kwan & Daniel Scheinert',
    releaseYear: '2022',
    posterUrl: 'https://image.tmdb.org/t/p/w500/w3LxiVYPqRLexP07ApWYWum93v7.jpg',
    genres: ['Action', 'Adventure', 'Science Fiction', 'Comedy'],
    runtimeMinutes: 139,
    overview: 'An aging Chinese immigrant is swept up in an insane adventure, where she alone can save what is important to her by connecting with other lives she could have led in the multiverse.',
    streamingProviders: ['Netflix', 'Amazon Prime Video'],
    moodTags: { darkness: 2, romance: 3, suspense: 3, plotTwists: 4, emotionalIntensity: 5 }
  },
  {
    id: 'movie_gone_girl',
    catalogId: '210577',
    source: 'tmdb',
    mediaType: 'movie',
    title: 'Gone Girl',
    creator: 'David Fincher',
    releaseYear: '2014',
    posterUrl: 'https://image.tmdb.org/t/p/w500/qymaJhucquUwjpb8DYBPxDNxd8d.jpg',
    genres: ['Mystery', 'Thriller', 'Drama'],
    runtimeMinutes: 149,
    overview: 'With his wife\'s disappearance having become the focus of an intense media circus, a man sees the spotlight turned on him when it\'s suspected that he may not be innocent.',
    streamingProviders: ['Max', 'Apple TV'],
    moodTags: { darkness: 5, romance: 2, suspense: 5, plotTwists: 5, emotionalIntensity: 4 }
  },
  {
    id: 'movie_spirited_away',
    catalogId: '129',
    source: 'tmdb',
    mediaType: 'movie',
    title: 'Spirited Away',
    creator: 'Hayao Miyazaki',
    releaseYear: '2001',
    posterUrl: 'https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg',
    genres: ['Animation', 'Family', 'Fantasy'],
    runtimeMinutes: 125,
    overview: 'A 10-year-old girl wanders into a world ruled by gods, witches, and spirits, and where humans are changed into beasts.',
    streamingProviders: ['Max'],
    moodTags: { darkness: 2, romance: 2, suspense: 3, plotTwists: 3, emotionalIntensity: 4 }
  },

  // TELEVISION SHOWS
  {
    id: 'tv_severance',
    catalogId: '95396',
    source: 'tmdb',
    mediaType: 'tv',
    title: 'Severance',
    creator: 'Dan Erickson',
    releaseYear: '2022',
    posterUrl: 'https://image.tmdb.org/t/p/w500/b8pW7L1bWc8Zk9dG4pCgK2qB3Qz.jpg',
    genres: ['Drama', 'Mystery', 'Science Fiction'],
    runtimeMinutes: 50,
    overview: 'Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives. When a mysterious colleague appears outside of work, it begins a journey to discover the truth.',
    streamingProviders: ['Apple TV+'],
    episodeCount: 9,
    moodTags: { darkness: 4, romance: 2, suspense: 5, plotTwists: 5, emotionalIntensity: 4 }
  },
  {
    id: 'tv_dark',
    catalogId: '70523',
    source: 'tmdb',
    mediaType: 'tv',
    title: 'Dark',
    creator: 'Baran bo Odar & Jantje Friese',
    releaseYear: '2017',
    posterUrl: 'https://image.tmdb.org/t/p/w500/apbrbWs8M9lyOpJYU5WXrpFbk1Z.jpg',
    genres: ['Sci-Fi & Fantasy', 'Drama', 'Mystery'],
    runtimeMinutes: 60,
    overview: 'A missing child sets four families on a frantic hunt for answers as they unearth a mind-bending mystery that spans three generations in a small German town.',
    streamingProviders: ['Netflix'],
    episodeCount: 26,
    moodTags: { darkness: 5, romance: 2, suspense: 5, plotTwists: 5, emotionalIntensity: 5 }
  },
  {
    id: 'tv_fleabag',
    catalogId: '67070',
    source: 'tmdb',
    mediaType: 'tv',
    title: 'Fleabag',
    creator: 'Phoebe Waller-Bridge',
    releaseYear: '2016',
    posterUrl: 'https://image.tmdb.org/t/p/w500/lKkwzP05q5c49kK9vG4q9Zk2jC5.jpg',
    genres: ['Comedy', 'Drama'],
    runtimeMinutes: 27,
    overview: 'A dry-witted woman, known only as Fleabag, has no filter as she navigates life and love in London while trying to cope with tragedy.',
    streamingProviders: ['Amazon Prime Video'],
    episodeCount: 12,
    moodTags: { darkness: 2, romance: 4, suspense: 1, plotTwists: 3, emotionalIntensity: 4 }
  },
  {
    id: 'tv_only_murders',
    catalogId: '107113',
    source: 'tmdb',
    mediaType: 'tv',
    title: 'Only Murders in the Building',
    creator: 'Steve Martin & John Hoffman',
    releaseYear: '2021',
    posterUrl: 'https://image.tmdb.org/t/p/w500/5v0J0uO7sU5sKz5nB2vXf9M1yU7.jpg',
    genres: ['Comedy', 'Crime', 'Mystery'],
    runtimeMinutes: 35,
    overview: 'Three strangers who share an obsession with true crime podcasting suddenly find themselves wrapped up in one when a gruesome death occurs inside their Upper West Side apartment building.',
    streamingProviders: ['Hulu', 'Disney+'],
    episodeCount: 30,
    moodTags: { darkness: 2, romance: 2, suspense: 4, plotTwists: 4, emotionalIntensity: 2 }
  },

  // BOOKS
  {
    id: 'book_seven_husbands',
    catalogId: 'gb_7husbands',
    source: 'google_books',
    mediaType: 'book',
    title: 'The Seven Husbands of Evelyn Hugo',
    creator: 'Taylor Jenkins Reid',
    releaseYear: '2017',
    posterUrl: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1664458703i/32620332.jpg',
    genres: ['Historical Fiction', 'Romance', 'Drama'],
    pageCount: 389,
    overview: 'Aging and reclusive Hollywood movie icon Evelyn Hugo is finally ready to tell the truth about her glamorous and scandalous life, choosing an unknown magazine reporter Monique Grant to write her biography.',
    moodTags: { darkness: 3, romance: 5, suspense: 3, plotTwists: 5, emotionalIntensity: 5 }
  },
  {
    id: 'book_silent_patient',
    catalogId: 'gb_silentpatient',
    source: 'google_books',
    mediaType: 'book',
    title: 'The Silent Patient',
    creator: 'Alex Michaelides',
    releaseYear: '2019',
    posterUrl: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1668782119i/40097951.jpg',
    genres: ['Thriller', 'Psychological Thriller', 'Mystery'],
    pageCount: 336,
    overview: 'Alicia Berenson’s life is seemingly perfect. Then late one evening, she shoots her husband five times in the face and never speaks another word.',
    moodTags: { darkness: 4, romance: 1, suspense: 5, plotTwists: 5, emotionalIntensity: 4 }
  },
  {
    id: 'book_project_hail_mary',
    catalogId: 'gb_hailmary',
    source: 'google_books',
    mediaType: 'book',
    title: 'Project Hail Mary',
    creator: 'Andy Weir',
    releaseYear: '2021',
    posterUrl: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1597695864i/54493401.jpg',
    genres: ['Science Fiction', 'Adventure', 'Mystery'],
    pageCount: 496,
    overview: 'Ryland Grace is the sole survivor on a desperate, last-chance mission—and if he fails, humanity and the earth itself are doomed. He just doesn’t know that yet, because he can’t remember his own name.',
    moodTags: { darkness: 2, romance: 1, suspense: 4, plotTwists: 4, emotionalIntensity: 4 }
  },
  {
    id: 'book_tomorrow_and_tomorrow',
    catalogId: 'gb_tomorrow3',
    source: 'google_books',
    mediaType: 'book',
    title: 'Tomorrow, and Tomorrow, and Tomorrow',
    creator: 'Gabrielle Zevin',
    releaseYear: '2022',
    posterUrl: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1636978687i/58784475.jpg',
    genres: ['Literary Fiction', 'Contemporary', 'Drama'],
    pageCount: 416,
    overview: 'Two childhood friends reunite in college and create a blockbuster video game that catapults them into fame, wealth, joy, tragedy, and creative partnership over thirty years.',
    moodTags: { darkness: 2, romance: 3, suspense: 2, plotTwists: 3, emotionalIntensity: 5 }
  },

  // PODCASTS
  {
    id: 'pod_serial',
    catalogId: 'pod_serial_s1',
    source: 'podcast',
    mediaType: 'podcast',
    title: 'Serial',
    creator: 'Sarah Koenig & Julie Snyder',
    releaseYear: '2014',
    posterUrl: 'https://serialpodcast.org/sites/all/modules/custom/serial/img/serial-itunes-logo.png',
    genres: ['True Crime', 'Investigative Journalism', 'Mystery'],
    runtimeMinutes: 45,
    overview: 'Serial tells one true story over the course of a season. Season One investigates the 1999 murder of Hae Min Lee and the conviction of Adnan Syed, following clues and contradictions.',
    streamingProviders: ['Spotify', 'Apple Podcasts'],
    moodTags: { darkness: 4, romance: 1, suspense: 5, plotTwists: 4, emotionalIntensity: 4 }
  },
  {
    id: 'pod_radio_rental',
    catalogId: 'pod_radiorental',
    source: 'podcast',
    mediaType: 'podcast',
    title: 'Radio Rental',
    creator: 'Payne Lindsey & Rainn Wilson',
    releaseYear: '2019',
    posterUrl: 'https://tenderfoot.tv/wp-content/uploads/2021/04/RadioRental_AlbumArt_Season2_3000x3000.jpg',
    genres: ['Horror', 'Storytelling', 'Comedy'],
    runtimeMinutes: 32,
    overview: 'Set inside a fictional 80s video rental store hosted by Terry Carnation, real people share unbelievable, terrifying, real-life encounters with bizarre phenomena and near-death mysteries.',
    streamingProviders: ['Spotify', 'Apple Podcasts'],
    moodTags: { darkness: 4, romance: 1, suspense: 4, plotTwists: 4, emotionalIntensity: 3 }
  },
  {
    id: 'pod_heavyweight',
    catalogId: 'pod_heavyweight',
    source: 'podcast',
    mediaType: 'podcast',
    title: 'Heavyweight',
    creator: 'Jonathan Goldstein',
    releaseYear: '2016',
    posterUrl: 'https://images.megaphone.fm/3s7s6sK5X7xG7v9m9l2w7p.jpg',
    genres: ['Personal Stories', 'Comedy', 'Human Interest'],
    runtimeMinutes: 38,
    overview: 'Jonathan Goldstein helps ordinary people confront the defining moments of their past: unresolved regrets, broken relationships, and the moments they wish they could do over.',
    streamingProviders: ['Spotify', 'Apple Podcasts'],
    moodTags: { darkness: 1, romance: 2, suspense: 2, plotTwists: 3, emotionalIntensity: 5 }
  },
  {
    id: 'pod_huberman_lab',
    catalogId: 'pod_huberman',
    source: 'podcast',
    mediaType: 'podcast',
    title: 'Huberman Lab',
    creator: 'Dr. Andrew Huberman',
    releaseYear: '2021',
    posterUrl: 'https://images.megaphone.fm/hubermanlab_cover.jpg',
    genres: ['Science', 'Health & Fitness', 'Personal Development'],
    runtimeMinutes: 110,
    overview: 'Neurobiology professor Dr. Andrew Huberman discusses neuroscience: how our brain and its connections with the organs of our body control our perceptions, our behaviors, and our health.',
    streamingProviders: ['Spotify', 'Apple Podcasts', 'YouTube'],
    moodTags: { darkness: 1, romance: 1, suspense: 1, plotTwists: 1, emotionalIntensity: 2 }
  }
];

export function getFilteredCatalogCandidates(filters: {
  formats?: string[];
  maxDurationMinutes?: number;
  streamingServices?: string[];
}): CatalogMediaItem[] {
  return VERIFIED_CATALOG.filter((item) => {
    // Media format filter
    if (filters.formats && filters.formats.length > 0) {
      if (!filters.formats.includes(item.mediaType)) {
        return false;
      }
    }

    // Duration filter
    if (filters.maxDurationMinutes && filters.maxDurationMinutes > 0) {
      if (item.runtimeMinutes && item.runtimeMinutes > filters.maxDurationMinutes) {
        return false;
      }
      if (item.pageCount && item.pageCount > filters.maxDurationMinutes * 2) {
        // approx 1 page = 1-2 mins
        return false;
      }
    }

    // Streaming services filter (only for video/podcast with streaming info)
    if (filters.streamingServices && filters.streamingServices.length > 0) {
      if (item.streamingProviders && item.streamingProviders.length > 0) {
        const hasService = item.streamingProviders.some((p) =>
          filters.streamingServices!.some(s => s.toLowerCase() === p.toLowerCase())
        );
        if (!hasService && (item.mediaType === 'movie' || item.mediaType === 'tv')) {
          // If the user strictly filtered by streaming service, exclude items not on those services
          return false;
        }
      }
    }

    return true;
  });
}
