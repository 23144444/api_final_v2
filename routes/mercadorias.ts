import { Unidade,Categoria, PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'

const prisma = new PrismaClient()

const router = Router()

const mercadoriaSchema = z.object({
  nome: z.string().min(2,
    { message: "Nome deve possuir, no mínimo, 2 caracteres" }),
  preco: z.number(),
  quantidade: z.number(),
  categoria: z.nativeEnum(Categoria).optional(),
  unidade: z.nativeEnum(Unidade).optional(),
  foto: z.string(),
  destaque: z.boolean().optional(),
  feirante_id: z.number(),
  emoji: z.string().optional()
  // usuario_id: z.string()
})

router.get("/", async (req, res) => {
  try {
    const mercadorias = await prisma.mercadoria.findMany({
      include: {
        feirante: true,
        fotos: true
      }
    })
    res.status(200).json(mercadorias)
  } catch (error) {
    res.status(500).json({ erro: error })
  }
})

router.get("/feirantes/:feiranteId", async (req, res) => {
  // Captura o id do feirante a partir dos parâmetros da rota
  const { feiranteId } = req.params;

  try {
    // Busca no banco de dados todas as mercadorias que correspondem ao feirante_id
    const mercadoriasDoFeirante = await prisma.mercadoria.findMany({
      where: {
        // Converte o id para número, pois ele vem como string da URL
        feirante_id: Number(feiranteId),
      },
      include: {
        // Você pode incluir outros dados se precisar, mas o feirante aqui seria redundante
        fotos: true,
      },
    });

    // Se não encontrar nenhuma mercadoria, pode retornar um array vazio (o que é normal)
    res.status(200).json(mercadoriasDoFeirante);

  } catch (error) {
    res.status(500).json({ erro: "Ocorreu um erro ao buscar as mercadorias do feirante.", detalhes: error });
  }
});

router.post("/", async (req, res) => {

  const valida = mercadoriaSchema.safeParse(req.body)
  if (!valida.success) {
    res.status(400).json({ erro: valida.error })
    return
  }

  const { nome, preco, quantidade, categoria = 'FRUTAS', unidade = 'UN', foto,
    destaque = true,  feirante_id } = valida.data

  try {
    const mercadoria = await prisma.mercadoria.create({
      data: {
        nome, preco, quantidade, categoria, unidade, foto, destaque, feirante_id
      }
    })
    res.status(201).json(mercadoria)
  } catch (error) {
    res.status(400).json({ error })
  }
})

router.delete("/:id", async (req, res) => {
  const { id } = req.params

  try {
    const mercadoria = await prisma.mercadoria.delete({
      where: { id: Number(id) }
    })
    res.status(200).json(mercadoria)
  } catch (error) {
    res.status(400).json({ erro: error })
  }
})

router.put("/:id", async (req, res) => {
  const { id } = req.params

  const valida = mercadoriaSchema.safeParse(req.body)
  if (!valida.success) {
    res.status(400).json({ erro: valida.error })
    return
  }

  const { nome, preco, quantidade, categoria, foto, destaque, feirante_id } = valida.data

  try {
    const mercadoria = await prisma.mercadoria.update({
      where: { id: Number(id) },
      data: {
        nome, preco, quantidade, categoria, foto, destaque, feirante_id
      }
    })
    res.status(200).json(mercadoria)
  } catch (error) {
    res.status(400).json({ error })
  }
})

router.get("/pesquisa/:termo", async (req, res) => {
  const { termo } = req.params

  // tenta converter para número
  const termoNumero = Number(termo)

  // is Not a Number, ou seja, se não é um número: filtra por texto
  if (isNaN(termoNumero)) {
    try {
      const termoUpperCase = termo.toUpperCase();
      const categorias = ["FRUTAS", "LEGUMES", "VERDURAS", "TEMPEROS"];
      const isCategoriaValida = categorias.includes(termoUpperCase); 

      const mercadorias = await prisma.mercadoria.findMany({
        include: {
          feirante: true,
        },
        // mode sensitive (Para não diferenciar maiuscula de minúsculas)
        // necessário no PostgreSQL (NO MySQL é o padrão)
        where: {
          OR: [
            { nome: { contains: termo, mode: "insensitive" } },
            { feirante: { nome: { equals: termo, mode: "insensitive" } } },
            ...(isCategoriaValida ? [{ 
              categoria: termoUpperCase as "FRUTAS" | "LEGUMES" | "VERDURAS" | "TEMPEROS"
            }] : [])
          ]
        }
      })
      res.status(200).json(mercadorias)
    } catch (error) {
      res.status(500).json({ erro: error })
    }
  } else {
    try {
      const mercadorias = await prisma.mercadoria.findMany({
        include: {
          feirante: true,
        },
        where: { 
          preco: { lte: termoNumero } 
        }
      })
      res.status(200).json(mercadorias)
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(500).json({ erro: error.message })
      } else {
        res.status(500).json({ erro: "Erro desconhecido" })
      }
    }
}})

// Rota de Consulta de mercadoria pelo Id, retorna um OBJETO, não um ARRAY
router.get("/:id", async (req, res) => {
  const { id } = req.params

  try {
    const mercadoria = await prisma.mercadoria.findUnique({
      where: { id: Number(id)},
      include: {
        feirante: true
      }
    })
    res.status(200).json(mercadoria)
  } catch (error) {
    res.status(400).json(error)
  }
})

export default router
