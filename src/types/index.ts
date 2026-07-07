export interface User {
  fullName: string;
  email: string;
  phone?: string;
}

export interface Show {
  id: string;
  title: string;
  price: number;
  date: string;
  genre: 'TECHNO' | 'INDIE ROCK' | 'METAL';
  imageSrc: string;
}
