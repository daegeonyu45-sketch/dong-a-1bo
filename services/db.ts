import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'DongaNewsDB';
const STORE_NAME = 'articles';
const IMAGE_STORE = 'images';
const HEADLINE_STORE = 'headlines';
const AUDIO_STORE = 'audioArchive';
const VERSION = 4;

export interface Article {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  factCheck: string | string[];
  date: string;
  image?: string | null;
  searchSources?: { uri: string; title: string }[];
}

export interface SavedImage {
  id: number;
  prompt: string;
  url: string;
  date: string;
}

export interface SavedHeadline {
  id: number;
  name: string;
  headline: string;
  image: string;
  reactions: {
    like: number;
    heart: number;
    angry: number;
    sad: number;
  };
  comments: {
    id: number;
    user: string;
    text: string;
    date: string;
  }[];
  date: string;
}

export interface SavedAudioNews {
  id: number;
  title: string;
  lyrics: string;
  timestamp: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(IMAGE_STORE)) {
          db.createObjectStore(IMAGE_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(HEADLINE_STORE)) {
          db.createObjectStore(HEADLINE_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(AUDIO_STORE)) {
          db.createObjectStore(AUDIO_STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

export const storage = {
  async getAll(): Promise<Article[]> {
    const db = await getDB();
    const articles = await db.getAll(STORE_NAME);
    return articles.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async save(article: Article): Promise<void> {
    const db = await getDB();
    await db.put(STORE_NAME, article);
  },

  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete(STORE_NAME, id);
  },

  async clear(): Promise<void> {
    const db = await getDB();
    await db.clear(STORE_NAME);
  },

  // Image Storage Methods
  async getAllImages(): Promise<SavedImage[]> {
    const db = await getDB();
    const images = await db.getAll(IMAGE_STORE);
    return images.sort((a, b) => b.id - a.id);
  },

  async saveImage(image: SavedImage): Promise<void> {
    const db = await getDB();
    await db.put(IMAGE_STORE, image);
  },

  async deleteImage(id: number): Promise<void> {
    const db = await getDB();
    await db.delete(IMAGE_STORE, id);
  },

  // Headline Storage Methods
  async getAllHeadlines(): Promise<SavedHeadline[]> {
    const db = await getDB();
    const headlines = await db.getAll(HEADLINE_STORE);
    return headlines.sort((a, b) => b.id - a.id);
  },

  async saveHeadline(headline: SavedHeadline): Promise<void> {
    const db = await getDB();
    await db.put(HEADLINE_STORE, headline);
  },

  async deleteHeadline(id: number): Promise<void> {
    const db = await getDB();
    await db.delete(HEADLINE_STORE, id);
  },

  async clearHeadlines(): Promise<void> {
    const db = await getDB();
    await db.clear(HEADLINE_STORE);
  },

  // Audio Storage Methods
  async getAllAudio(): Promise<SavedAudioNews[]> {
    const db = await getDB();
    const audio = await db.getAll(AUDIO_STORE);
    return audio.sort((a, b) => b.id - a.id);
  },

  async saveAudio(audio: SavedAudioNews): Promise<void> {
    const db = await getDB();
    await db.put(AUDIO_STORE, audio);
  },

  async deleteAudio(id: number): Promise<void> {
    const db = await getDB();
    await db.delete(AUDIO_STORE, id);
  },

  async migrateFromLocalStorage(): Promise<void> {
    try {
      // Migrate articles
      const savedRaw = localStorage.getItem('dashboard_db');
      if (savedRaw) {
        const saved = JSON.parse(savedRaw);
        if (Array.isArray(saved) && saved.length > 0) {
          const db = await getDB();
          const tx = db.transaction(STORE_NAME, 'readwrite');
          for (const article of saved) {
            await tx.store.put(article);
          }
          await tx.done;
          localStorage.removeItem('dashboard_db');
        }
      }

      // Migrate images
      const imagesRaw = localStorage.getItem('my_images');
      if (imagesRaw) {
        const images = JSON.parse(imagesRaw);
        if (Array.isArray(images) && images.length > 0) {
          const db = await getDB();
          const tx = db.transaction(IMAGE_STORE, 'readwrite');
          for (const img of images) {
            await tx.store.put(img);
          }
          await tx.done;
          localStorage.removeItem('my_images');
        }
      }

      // Migrate headlines
      const headlinesRaw = localStorage.getItem('viewer_headlines');
      if (headlinesRaw) {
        const headlines = JSON.parse(headlinesRaw);
        if (Array.isArray(headlines) && headlines.length > 0) {
          const db = await getDB();
          const tx = db.transaction(HEADLINE_STORE, 'readwrite');
          for (const h of headlines) {
            await tx.store.put(h);
          }
          await tx.done;
          localStorage.removeItem('viewer_headlines');
        }
      }

      // Migrate audio
      const audioRaw = localStorage.getItem('donga_audio_archive');
      if (audioRaw) {
        const audio = JSON.parse(audioRaw);
        if (Array.isArray(audio) && audio.length > 0) {
          const db = await getDB();
          const tx = db.transaction(AUDIO_STORE, 'readwrite');
          for (const a of audio) {
            await tx.store.put(a);
          }
          await tx.done;
          localStorage.removeItem('donga_audio_archive');
        }
      }
    } catch (e) {
      console.error('Migration failed:', e);
    }
  }
};
