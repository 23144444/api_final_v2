import { PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'

const prisma = new PrismaClient()
const router = Router()

const cestaSchema = z.object({
  nome: z.string().min(3),
  preco: z.number().positive(),
  feirante_id: z.number(),
  desconto: z.string().optional(),
  imagem: z.string().url().optional(),
  emoji: z.string().optional(),
  categoria: z.string().optional(),
  mercadorias: z.array(z.number()).optional(),
})


router.get("/", async (req, res) => {
  try {
    const cestas = await prisma.cesta.findMany({
      include: {
        feirante: true,
        mercadorias: true,
      },
    })
    res.status(200).json(cestas)
  } catch (error) {
    res.status(500).json({ erro: error })
  }
})


router.post("/", async (req, res) => {
  const result = cestaSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ erro: result.error.flatten().fieldErrors })
  }

  const { mercadorias, ...cestaData } = result.data

  try {
    const novaCesta = await prisma.cesta.create({
      data: {
        ...cestaData,
        mercadorias: {
          connect: mercadorias?.map(id => ({ id })),
        },
      },
      include: {
        mercadorias: true,
      },
    })
    res.status(201).json(novaCesta)
  } catch (error) {
    res.status(400).json({ erro: error })
  }
})


router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const cesta = await prisma.cesta.findUnique({
        where: { id: Number(id) },
        include: {
            feirante: true,
            mercadorias: true,
        }
      });
      if (!cesta) {
        return res.status(404).json({ erro: "Cesta não encontrada." });
      }
      res.status(200).json(cesta);
    } catch (error) {
      res.status(500).json({ erro: error });
    }
  });

router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const result = cestaSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ erro: "Dados inválidos", detalhes: result.error.flatten().fieldErrors });
    }

    const { mercadorias, ...cestaData } = result.data;

    try {
        const cestaAtualizada = await prisma.cesta.update({
            where: { id: Number(id) },
            data: {
                ...cestaData,
                mercadorias: {
                    // 'set' remove todas as conexões antigas e adiciona as novas
                    set: mercadorias?.map(id => ({ id }))
                }
            },
            include: { mercadorias: true }
        });
        res.status(200).json(cestaAtualizada);
    } catch (error) {
        res.status(500).json({ erro: "Não foi possível atualizar a cesta", detalhes: error });
    }
});


router.patch("/:id", async (req, res) => {
    const { id } = req.params;
    const result = cestaSchema.partial().safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ erro: "Dados inválidos", detalhes: result.error.flatten().fieldErrors });
    }

    const { mercadorias, ...cestaData } = result.data;

    try {
        const cestaAtualizada = await prisma.cesta.update({
            where: { id: Number(id) },
            data: {
                ...cestaData,
                // Apenas atualiza as mercadorias se um novo array for enviado
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
        res.status(500).json({ erro: "Não foi possível atualizar a cesta", detalhes: error });
    }
});


router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.cesta.delete({
            where: { id: Number(id) }
        });
        res.status(200).json({ message: "Cesta deletada com sucesso." });
    } catch (error) {
        res.status(500).json({ erro: "Não foi possível deletar a cesta", detalhes: error });
    }
});


export default router