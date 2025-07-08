import { PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'

const prisma = new PrismaClient()
const router = Router()

const cestaRecorrenteSchema = z.object({
  nome: z.string().min(3),
  preco: z.number().positive(),
  frequencia: z.string(),
  dia_entrega: z.string(),
  ativa: z.boolean().optional(),
  usuario_id: z.string().uuid(),
  feirante_id: z.number().int().positive(),
  mercadorias: z.array(z.number().int().positive()).optional(),
})

router.get("/", async (req, res) => {
    try {
      const cestas = await prisma.cestaRecorrente.findMany({
        include: { feirante: true, usuario: true, mercadorias: true },
      })
      res.status(200).json(cestas)
    } catch (error) {
      res.status(500).json({ erro: "Erro ao buscar cestas recorrentes", detalhes: error })
    }
  })

router.post("/", async (req, res) => {
  const result = cestaRecorrenteSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ erro: "Erro de validação", detalhes: result.error.flatten().fieldErrors })
  }

  const { mercadorias, ...cestaData } = result.data

  try {
    const novaCesta = await prisma.cestaRecorrente.create({
      data: {
        ...cestaData,
        mercadorias: {
          connect: mercadorias?.map(id => ({ id })),
        },
      },
      include: { mercadorias: true },
    })
    res.status(201).json(novaCesta)
  } catch (error) {
    res.status(400).json({ erro: "Não foi possível criar a cesta recorrente", detalhes: error })
  }
})

router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const result = cestaRecorrenteSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ erro: "Dados inválidos", detalhes: result.error.flatten().fieldErrors });
    }

    const { mercadorias, ...cestaData } = result.data;

    try {
        const cestaAtualizada = await prisma.cestaRecorrente.update({
            where: { id: Number(id) },
            data: {
                ...cestaData,
                mercadorias: {
                    set: mercadorias?.map(id => ({ id }))
                }
            },
            include: { mercadorias: true }
        });
        res.status(200).json(cestaAtualizada);
    } catch (error) {
        res.status(500).json({ erro: "Não foi possível atualizar a cesta recorrente", detalhes: error });
    }
});

router.patch("/:id", async (req, res) => {
    const { id } = req.params;
    const result = cestaRecorrenteSchema.partial().safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ erro: "Dados inválidos", detalhes: result.error.flatten().fieldErrors });
    }

    const { mercadorias, ...cestaData } = result.data;

    try {
        const cestaAtualizada = await prisma.cestaRecorrente.update({
            where: { id: Number(id) },
            data: {
                ...cestaData,
                ...(mercadorias && {
                    mercadorias: {
                        set: mercadorias.map(id => ({ id }))
                    }
                })
            },
            include: { mercadorias: true }
        });
        res.status(200).json(cestaAtualizada);
    } catch (error) {
        res.status(500).json({ erro: "Não foi possível atualizar a cesta recorrente", detalhes: error });
    }
});

router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.cestaRecorrente.delete({
            where: { id: Number(id) }
        });
        res.status(200).json({ message: "Cesta recorrente deletada com sucesso." });
    } catch (error) {
        res.status(500).json({ erro: "Não foi possível deletar a cesta recorrente", detalhes: error });
    }
});

export default router
