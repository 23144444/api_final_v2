// import { PrismaClient } from "@prisma/client"
// import { Router } from "express"
// import bcrypt from 'bcrypt'
// import { z } from 'zod'
// // import { verificaToken } from '../middlewares/verificaToken'
// // import { verificaNivel } from '../middlewares/verificaNivel'

// const prisma = new PrismaClient()
// const router = Router()

// const usuarioSchema = z.object({
//   // id: z.string(),
//   nome: z.string(),
//   email: z.string(),
//   senha: z.string(),
//   nivel: z.number()
// })

// router.get("/", async (req, res) => {
//   try {
//     const usuarios = await prisma.usuario.findMany()
//     res.status(200).json(usuarios)
//   } catch (error) {
//     res.status(400).json(error)
//   }
// })

// function validaSenha(senha: string) {

//   const mensa: string[] = []

 
//   if (senha.length < 8) {
//     mensa.push("Erro... senha deve possuir, no mínimo, 8 caracteres")
//   }

//   // contadores
//   let pequenas = 0
//   let grandes = 0
//   let numeros = 0
//   let simbolos = 0

 
//   for (const letra of senha) {
   
//     if ((/[a-z]/).test(letra)) {
//       pequenas++
//     }
//     else if ((/[A-Z]/).test(letra)) {
//       grandes++
//     }
//     else if ((/[0-9]/).test(letra)) {
//       numeros++
//     } else {
//       simbolos++
//     }
//   }

//   if (pequenas == 0) {
//     mensa.push("Erro... senha deve possuir letra(s) minúscula(s)")
//   }

//   if (grandes == 0) {
//     mensa.push("Erro... senha deve possuir letra(s) maiúscula(s)")
//   }

//   if (numeros == 0) {
//     mensa.push("Erro... senha deve possuir número(s)")
//   }

//   if (simbolos == 0) {
//     mensa.push("Erro... senha deve possuir símbolo(s)")
//   }

//   return mensa
// }

// // router.post("/", verificaToken, verificaNivel(3), async (req, res) => {
// router.post("/", async (req, res) => {

//   const valida = usuarioSchema.safeParse(req.body)
//   if (!valida.success) {
//     res.status(400).json({ erro: valida.error })
//     return
//   }
  

//   const erros = validaSenha(valida.data.senha)
//   if (erros.length > 0) {
//     res.status(400).json({ erro: erros.join("; ") })
//     return
//   }

//   const salt = bcrypt.genSaltSync(12)
 
//   const hash = bcrypt.hashSync(valida.data.senha, salt)

//   try {
//     const usuario = await prisma.usuario.create({
//       data: { ...valida.data, senha: hash }
//     })
//     res.status(201).json(usuario)
//   } catch (error) {
//     res.status(400).json({ mensagem: 'E-mail já cadastrado.' })
//   }
// })

// // router.patch("/alterar-senha/:id", verificaToken, async (req, res) => {
// router.patch("/alterar-senha/:id", async (req, res) => {
//   const { id } = req.params;
//   const { senha, senhaNova } = req.body;

//   const userId = id;
//   if (userId != "") {
//     return res.status(400).json({ erro: "ID inválido" });
//   }

//   const erros = validaSenha(senhaNova);
//   if (erros.length > 0) {
//     return res.status(400).json({ erro: erros.join("; ") });
//   }

//   try {
//     const usuario = await prisma.usuario.findUnique({ where: { id: userId } });
//     if (!usuario) {
//       return res.status(404).json({ erro: "Usuário não encontrado" });
//     }

//     const senhaValida = bcrypt.compareSync(senha, usuario.senha);
//     if (!senhaValida) {
//       return res.status(400).json({ erro: "Senha antiga incorreta" });
//     }

//     const salt = bcrypt.genSaltSync(12);
//     const hash = bcrypt.hashSync(senhaNova, salt);

//     const usuarioAtualizado = await prisma.usuario.update({
//       where: { id: userId },
//       data: { senha: hash },
//     });

//     res.status(200).json(usuarioAtualizado);
//   } catch (error) {
//     if (error instanceof Error) {
//       console.error("Erro ao alterar senha:", error.message);
//       res.status(400).json({ erro: "Erro ao processar a solicitação", detalhes: error.message });
//     } else {
//       console.error("Erro desconhecido:", error);
//       res.status(400).json({ erro: "Erro desconhecido ao processar a solicitação" });
//     }
//   }
// });
// export default router

import { Router, Request, Response } from "express";
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

import bcrypt, { compareSync } from "bcrypt";
import jwt from 'jsonwebtoken';
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient()

const router = Router()

const usuarioSchema = z.object({
  nome: z.string().min(2,
    { message: "Nome deve possuir, no mínimo, 2 caracteres" }),

  email: z.string().email({
      message: "E-mail inválido"
    }),
  
  senha: z.string()
      .min(8, { message: "A senha deve ter no mínimo 8 caracteres" })
      .regex(/[A-Z]/, { message: "A senha deve conter pelo menos uma letra maiúscula" })
      .regex(/[^A-Za-z0-9]/, { message: "A senha deve conter pelo menos um caractere especial" }),
  
  telefone: z.string()
      .regex(/^\d{10,11}$/, {
        message: "Telefone deve conter apenas números e ter entre 10 e 11 dígitos"
      }),
  
  endereco: z.string().min(2, {
      message: "Endereço deve possuir, no mínimo, 2 caracteres"
    }),
  })

router.get("/", async (req, res) => {
  try {
    const usuario = await prisma.usuario.findMany({
    
    })
    res.status(200).json(usuario)
  } catch (error) {
    res.status(500).json({ erro: error })
  }
})

router.post("/", async (req, res) => {
  const valida = usuarioSchema.safeParse(req.body)
  if (!valida.success) {
    return res.status(400).json({ erro: valida.error.errors });
  }

  const { nome, email, senha, telefone, endereco } = valida.data;

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(senha, salt);

    const usuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senha: hashedPassword,
        telefone,
        endereco,
      },
    });
    res.status(201).json({ message: "Usuário cadastrado com sucesso", usuario });
  } catch (error: any) {
    if (error.code === 'P2002') { // Unique constraint violation
      return res.status(400).json({ error: 'E-mail já cadastrado.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Erro ao cadastrar usuário.' });
  }
});

// Rota de Login
router.post("/login", async (req: Request, res: Response) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: "Email e senha são obrigatórios" });
  }

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { email },
    });

    if (!usuario) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);

    if (!senhaValida) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    // Gerar token JWT (opcional, mas recomendado)
    const token = jwt.sign(
      { 
        userId: usuario.id,
        email: usuario.email,
        // userNivel: usuario.nivel,
      },
      process.env.JWT_SECRET || 'sua-chave-secreta', // Use uma chave segura no ambiente de produção
      { expiresIn: '1h' } // Define a expiração do token
    );

    res.json({ message: "Login bem-sucedido", token, usuario: {id: usuario.id, nome: usuario.nome, email: usuario.email} });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao realizar login" });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params

  try {
    const usuario = await prisma.usuario.delete({
      where: { id }
    })
    res.status(200).json(usuario)
  } catch (error) {
    res.status(400).json({ erro: error })
  }
})

router.put("/:id", async (req, res) => {
  const { id } = req.params

  const valida = usuarioSchema.safeParse(req.body)
  if (!valida.success) {
    res.status(400).json({ erro: valida.error })
    return
  }

  const { nome, email, senha, telefone, endereco } = valida.data

  try {
    const usuario = await prisma.usuario.update({
      where: { id },
      data: {
        nome, email, senha, telefone, endereco
      }
    })
    res.status(200).json(usuario)
  } catch (error) {
    res.status(400).json({ error })
  }
})

router.get("/pesquisa/:termo", async (req, res) => {
  const { termo } = req.params

  try {
    const usuarios = await prisma.usuario.findMany({
      where: {
        OR: [
          {
              nome: {
                contains: termo,
                mode: "insensitive"
              }
          },
          // {
          //   endereco: {
          //     contains: termo,
          //     mode: "insensitive"
          //   }
          // },
          {
            telefone: {
              contains: termo,
              mode: "insensitive"
            }
          }
        ]
      }
    })

    res.status(200).json(usuarios)
  } catch (error) {
    console.error(error)
    res.status(500).json({ erro: error })
  }
})

// Rota de Consulta de consumidor pelo Id, retorna um OBJETO, não um ARRAY
router.get("/:id", async (req, res) => {
  const { id } = req.params

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id },
    })
    res.status(200).json(usuario)
  } catch (error) {
    res.status(400).json(error)
  }
})

// 1) Solicitar código de recuperação
router.post("/solicitar-recuperacao", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email)
        return res.status(400).json({ error: "Email é obrigatório" });

      const usuario = await prisma.usuario.findUnique({
        where: { email },
      });
      if (!usuario)
        return res
          .status(404)
          .json({ error: "Usuario não encontrado" });

      // Gera um código numérico de 6 dígitos
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      await prisma.usuario.update({
        where: { email },
        data: { codigoRecuperacao: code },
      });
      // teste
      // console.log(usuario.codigoRecuperacao)
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: "Código de recuperação de senha",
        text: `Use este código para recuperar sua senha: ${code}`,
      });

      return res.json({
        message: "Código de recuperação enviado para seu email",
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Erro interno" });
    }
  }
);

// 2) Alterar senha usando código de recuperação
router.patch(
  "/alterar-senha",
  async (req: Request, res: Response) => {
    try {
      const {
        email,
        codigoRecuperacao,
        novaSenha: novaSenha, // variavel
        confirmarSenha: confirmarSenha, // variavel
      } = req.body;
      if (
        !email ||
        !codigoRecuperacao ||
        !novaSenha ||
        !confirmarSenha
      ) {
        return res
          .status(400)
          .json({ error: "Todos os campos são obrigatórios" });
      }
      if (novaSenha !== confirmarSenha) {
        return res
          .status(400)
          .json({ error: "As senhas não coincidem" });
      }

      const usuario = await prisma.usuario.findUnique({
        where: { email },
      });
      if (
        !usuario ||
        usuario.codigoRecuperacao !== codigoRecuperacao
      ) {
        return res
          .status(400)
          .json({ error: "Código de recuperação inválido" });
      }

      const hash = await bcrypt.hash(novaSenha, 10);
      await prisma.usuario.update({
        where: { email },
        data: { senha: hash, codigoRecuperacao: null },
      });


      return res.json({ message: "Senha alterada com sucesso" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Erro interno" });
    }
  }
);

export default router
