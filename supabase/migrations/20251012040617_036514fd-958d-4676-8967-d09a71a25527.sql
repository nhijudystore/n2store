-- Create printer_settings table for thermal printer configuration
CREATE TABLE IF NOT EXISTS public.printer_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  printer_name TEXT NOT NULL,
  printer_ip TEXT NOT NULL,
  printer_port INTEGER NOT NULL DEFAULT 9100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.printer_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own printer settings"
  ON public.printer_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own printer settings"
  ON public.printer_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own printer settings"
  ON public.printer_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own printer settings"
  ON public.printer_settings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_printer_settings_user_id ON public.printer_settings(user_id);
CREATE INDEX idx_printer_settings_active ON public.printer_settings(user_id, is_active) WHERE is_active = true;

-- Add trigger for updated_at
CREATE TRIGGER update_printer_settings_updated_at
  BEFORE UPDATE ON public.printer_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();