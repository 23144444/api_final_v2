import { PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'

const prisma = new PrismaClient()
const router = Router()

const feiraSchema = z.object({
  nome: z.string().min(3),
  endereco: z.string().min(5),
  horario: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  status: z.enum(['Aberto', 'Fechado']).optional(),
  imagem: z.string().url().optional(),
})

router.get("/", async (req, res) => {
  try {
    const feiras = await prisma.feira.findMany({
      include: {
        feirantes: true,
      }
    })
    res.status(200).json(feiras)
  } catch (error) {
    res.status(500).json({ erro: error })
  }
})

router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const feira = await prisma.feira.findUnique({
        where: { id: Number(id) },
        include: {
            feirantes: {
                include: {
                    mercadorias: true,
                    cestas: true
                }
            }
        }
      });
      if (!feira) {
        return res.status(404).json({ erro: "Feira não encontrada." });
      }
      res.status(200).json(feira);
    } catch (error) {
      res.status(500).json({ erro: error });
    }
  });

router.post("/", async (req, res) => {
  const result = feiraSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ erro: result.error.flatten().fieldErrors })
  }

  try {
    const novaFeira = await prisma.feira.create({
      data: result.data,
    })
    res.status(201).json(novaFeira)
  } catch (error) {
    res.status(400).json({ erro: error })
  }
})

router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const result = feiraSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({ erro: "Dados inválidos", detalhes: result.error.flatten().fieldErrors });
    }

    try {
        const feiraAtualizada = await prisma.feira.update({
            where: { id: Number(id) },
            data: result.data
        });
        res.status(200).json(feiraAtualizada);
    } catch (error) {
        res.status(500).json({ erro: "Não foi possível atualizar a feira", detalhes: error });
    }
});


router.patch("/:id", async (req, res) => {
    const { id } = req.params;
    // .partial() torna todos os campos opcionais para a validação
    const result = feiraSchema.partial().safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({ erro: "Dados inválidos", detalhes: result.error.flatten().fieldErrors });
    }

    try {
        const feiraAtualizada = await prisma.feira.update({
            where: { id: Number(id) },
            data: result.data
        });
        res.status(200).json(feiraAtualizada);
    } catch (error) {
        res.status(500).json({ erro: "Não foi possível atualizar a feira", detalhes: error });
    }
});


router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.feira.delete({
            where: { id: Number(id) }
        });
        res.status(200).json({ message: "Feira deletada com sucesso." });
    } catch (error) {
        res.status(500).json({ erro: "Não foi possível deletar a feira", detalhes: error });
    }
});


export default router;