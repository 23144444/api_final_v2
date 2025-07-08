import { PrismaClient, StatusPedido } from "@prisma/client"
import { Router } from "express"
import { z } from "zod"
import nodemailer from "nodemailer"

const prisma = new PrismaClient()
const router = Router()

const pedidoItemSchema = z.object({
  mercadoria_id: z.number().int().positive(),
  quantidade: z.number().positive(),
});

const criarPedidoSchema = z.object({
  usuario_id: z.string().uuid(),
  items: z.array(pedidoItemSchema).min(1, { message: "O pedido deve ter pelo menos um item." }),
});

router.post("/", async (req, res) => {
  const result = criarPedidoSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      erro: "Dados de entrada inválidos.",
      detalhes: result.error.flatten().fieldErrors
    });
  }

  const { usuario_id, items } = result.data;

  try {
    const novoPedido = await prisma.$transaction(async (tx) => {
      const idsMercadorias = items.map(item => item.mercadoria_id);
      const mercadorias = await tx.mercadoria.findMany({
        where: {
          id: { in: idsMercadorias }
        }
      });

      if (mercadorias.length !== idsMercadorias.length) {
        throw new Error("Uma ou mais mercadorias não foram encontradas.");
      }

      let valor_total = 0;
      const pedidoItemsData = items.map(item => {
        const mercadoria = mercadorias.find(m => m.id === item.mercadoria_id);
        if (!mercadoria) throw new Error(`Mercadoria com id ${item.mercadoria_id} não encontrada.`);
        
        const precoItem = Number(mercadoria.preco) * item.quantidade;
        valor_total += precoItem;

        if (Number(mercadoria.quantidade) < item.quantidade) {
            throw new Error(`Estoque insuficiente para a mercadoria "${mercadoria.nome}".`);
        }

        return {
          mercadoria_id: item.mercadoria_id,
          quantidade: item.quantidade,
          preco_unitario: mercadoria.preco,
        };
      });

      const pedido = await tx.pedido.create({
        data: {
          usuario_id,
          valor_total,
          status: 'PENDENTE',
        },
      });

      await tx.pedidoItem.createMany({
        data: pedidoItemsData.map(itemData => ({
          ...itemData,
          pedido_id: pedido.id
        }))
      });

       for (const item of items) {
        await tx.mercadoria.update({
            where: { id: item.mercadoria_id },
            data: { quantidade: { decrement: item.quantidade } }
        });
       }

      return tx.pedido.findUnique({
        where: { id: pedido.id },
        include: { items: { include: { mercadoria: true } }, usuario: true }
      });
    });

    res.status(201).json(novoPedido);
  } catch (error: any) {
    console.error("Erro ao criar pedido:", error);
    res.status(400).json({ erro: "Não foi possível criar o pedido.", detalhes: error.message });
  }
});

// Função de envio de e-mail para atualização de status do pedido
async function enviaEmailAtualizacaoStatus(
  nomeUsuario: string,
  emailUsuario: string,
  idPedido: number,
  novoStatus: string
) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })

  // Dados e-mail
  const statusFormatado = novoStatus.replace("_", " ").toLowerCase();

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: emailUsuario,
    subject: `Atualização sobre seu pedido #${idPedido}`,
    text: `Olá ${nomeUsuario},\n\nO status do seu pedido #${idPedido} foi atualizado para: ${statusFormatado}.`,
    html: `
      <h3>Olá, ${nomeUsuario}!</h3>
      <p>Temos uma novidade sobre o seu pedido de número <strong>#${idPedido}</strong>.</p>
      <p>Novo status: <strong>${statusFormatado.charAt(0).toUpperCase() + statusFormatado.slice(1)}</strong></p>
      <p>Obrigado por comprar conosco!</p>
    `
  })

  console.log("E-mail de atualização de status enviado: %s", info.messageId)
}

router.get("/", async (req, res) => {
  try {
    const pedidos = await prisma.pedido.findMany({
      include: {
        usuario: true,
        items: {
            include: {
                mercadoria: true
            }
        }
       },
      orderBy: { id: 'desc' }
    })
    res.status(200).json(pedidos)
  } catch (error) {
    res.status(400).json({ erro: error })
  }
})


router.get("/usuario/:usuario_id", async (req, res) => {
    const { usuario_id } = req.params
    try {
      const pedidos = await prisma.pedido.findMany({
        where: { usuario_id: String(usuario_id) },
        include: {
            items: {
                include: {
                    mercadoria: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
      })
      res.status(200).json(pedidos)
    } catch (error) {
      res.status(400).json({ erro: error })
    }
  })

// atualizar status COM ENVIO DE E-MAIL
router.patch("/:id", async (req, res) => {
    const { id } = req.params;
    const { status } = req.body as { status: StatusPedido };

    if (!status || !Object.values(StatusPedido).includes(status)) {
        return res.status(400).json({ erro: "Informe um status válido para o pedido." });
    }

    try {
        const pedidoAtualizado = await prisma.pedido.update({
            where: { id: Number(id) },
            data: { status },
            include: { usuario: true } 
        });

        
        if (pedidoAtualizado && pedidoAtualizado.usuario) {
            await enviaEmailAtualizacaoStatus(
                pedidoAtualizado.usuario.nome,
                pedidoAtualizado.usuario.email,
                pedidoAtualizado.id,
                pedidoAtualizado.status
            );
        }
        
        res.status(200).json(pedidoAtualizado);
    } catch (error) {
        console.error("Erro ao atualizar pedido:", error);
        res.status(400).json({ erro: "Não foi possível atualizar o status do pedido." });
    }
});

const pedidoUpdateSchema = z.object({
    status: z.nativeEnum(StatusPedido),
    adminId: z.string().uuid().optional().nullable(),
});

router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const result = pedidoUpdateSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({ erro: "Dados inválidos", detalhes: result.error.flatten().fieldErrors });
    }

    try {
        const pedidoAtualizado = await prisma.pedido.update({
            where: { id: Number(id) },
            data: result.data,
            include: { usuario: true }
        });

        // Envia e-mail se o status foi atualizado
        if (pedidoAtualizado && pedidoAtualizado.usuario) {
            await enviaEmailAtualizacaoStatus(
                pedidoAtualizado.usuario.nome,
                pedidoAtualizado.usuario.email,
                pedidoAtualizado.id,
                pedidoAtualizado.status
            );
        }

        res.status(200).json(pedidoAtualizado);
    } catch (error) {
        console.error("Erro ao atualizar pedido:", error);
        res.status(400).json({ erro: "Não foi possível atualizar o pedido.", detalhes: error });
    }
});

router.delete("/:id", async (req, res) => {
    const { id } = req.params;

    try {
        // A deleção em cascata configurada no schema irá remover os PedidoItems associados
        await prisma.pedido.delete({
            where: { id: Number(id) }
        });
        res.status(200).json({ message: "Pedido deletado com sucesso." });
    } catch (error) {
        console.error("Erro ao deletar pedido:", error);
        res.status(500).json({ erro: "Não foi possível deletar o pedido.", detalhes: error });
    }
});


export default router;