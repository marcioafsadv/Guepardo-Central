-- 1. Adicionar coluna full_name às tabelas vehicles e addresses
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS full_name TEXT;

-- 2. Popular os dados iniciais a partir da tabela profiles
UPDATE public.vehicles v
SET full_name = p.full_name
FROM public.profiles p
WHERE v.user_id = p.id;

UPDATE public.addresses a
SET full_name = p.full_name
FROM public.profiles p
WHERE a.user_id = p.id;

-- 3. Criar função para sincronização automática
CREATE OR REPLACE FUNCTION public.sync_driver_full_name()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.full_name IS DISTINCT FROM NEW.full_name) THEN
    UPDATE public.vehicles
    SET full_name = NEW.full_name
    WHERE user_id = NEW.id;

    UPDATE public.addresses
    SET full_name = NEW.full_name
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Criar o Trigger na tabela profiles
DROP TRIGGER IF EXISTS on_profile_name_change ON public.profiles;
CREATE TRIGGER on_profile_name_change
  AFTER UPDATE OF full_name ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_driver_full_name();

-- 5. Garantir que novos registros em vehicles/addresses também peguem o nome (Opcional, mas recomendado)
CREATE OR REPLACE FUNCTION public.set_initial_full_name()
RETURNS TRIGGER AS $$
BEGIN
  SELECT full_name INTO NEW.full_name
  FROM public.profiles
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_vehicle_insert ON public.vehicles;
CREATE TRIGGER on_vehicle_insert
  BEFORE INSERT ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_initial_full_name();

DROP TRIGGER IF EXISTS on_address_insert ON public.addresses;
CREATE TRIGGER on_address_insert
  BEFORE INSERT ON public.addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_initial_full_name();
