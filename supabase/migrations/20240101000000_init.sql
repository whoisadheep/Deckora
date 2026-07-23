-- Create tables for the presentation generator

-- We'll rely on Supabase's auth.users for authentication, but create a public profile table.
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    credits INTEGER DEFAULT 10
);

-- Presentations table
CREATE TABLE public.presentations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    theme_name TEXT DEFAULT 'Modern White',
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Slides table
CREATE TABLE public.slides (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    presentation_id UUID REFERENCES public.presentations(id) ON DELETE CASCADE NOT NULL,
    order_index INTEGER NOT NULL,
    layout_type TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    content JSONB,
    speaker_notes TEXT,
    visual_url TEXT,
    visual_type TEXT CHECK (visual_type IN ('image', 'chart', 'diagram'))
);

-- Themes table (for future custom themes)
CREATE TABLE public.themes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    config JSONB NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;

-- Create policies (Basic setup where users can see/edit their own data)
CREATE POLICY "Users can view own profile." ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own presentations." ON public.presentations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own presentations." ON public.presentations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own presentations." ON public.presentations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own presentations." ON public.presentations FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view slides of their presentations." ON public.slides FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.presentations WHERE id = slides.presentation_id AND user_id = auth.uid())
);
CREATE POLICY "Users can insert slides to their presentations." ON public.slides FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.presentations WHERE id = slides.presentation_id AND user_id = auth.uid())
);
CREATE POLICY "Users can update slides of their presentations." ON public.slides FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.presentations WHERE id = slides.presentation_id AND user_id = auth.uid())
);
CREATE POLICY "Users can delete slides of their presentations." ON public.slides FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.presentations WHERE id = slides.presentation_id AND user_id = auth.uid())
);

CREATE POLICY "Anyone can view themes." ON public.themes FOR SELECT USING (true);
