
export interface ArticleIdea {
  id: string;
  title: string;
  category: string;
  status: 'Draft' | 'Research' | 'Published';
  createdAt: string;
}

export interface AIArticleResponse {
  title: string;
  body: string[];
  keywords: string[];
}

export interface HeadlineOption {
  type: 'Formal' | 'Viral' | 'Emotional';
  text: string;
}

export interface NetizenReaction {
  user: string;
  comment: string;
  likes: number;
}

export type ViewType = 'dashboard' | 'writer' | 'illustrator' | 'headline' | 'comments' | 'audio';
