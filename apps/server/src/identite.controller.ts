import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Patch,
  Post,
  Req,
  SetMetadata,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  IDENTITE_PORT,
  ROLES_KEY,
  schemaLangue,
  type PortIdentite,
  type RoleApi,
} from "@smdg/contracts";
import { z } from "zod";

const schemaInvite = z.object({ langue: schemaLangue.default("fr") });
const schemaInscription = z.object({
  pseudo: z.string().trim().min(2).max(40),
  courriel: z.string().trim().email().max(254).optional(),
  motDePasse: z
    .string()
    .min(12)
    .refine((valeur) => Buffer.byteLength(valeur, "utf8") <= 72),
  langue: schemaLangue.default("fr"),
});
const schemaConnexion = z.object({
  identifiant: z.string().trim().min(1).max(254),
  motDePasse: z.string().min(1),
});
const schemaLangueProfil = z.object({ langue: schemaLangue });

interface RequeteAuthentifiee {
  readonly ip: string;
  readonly utilisateur?: { readonly utilisateurId: string; readonly role: RoleApi };
}

function parser<T>(schema: z.ZodType<T>, valeur: unknown): T {
  const resultat = schema.safeParse(valeur);
  if (!resultat.success) {
    throw new HttpException(
      {
        code: "ENTREE_INVALIDE",
        params: {
          champs: resultat.error.issues.map((issue) => issue.path.map(String).join(".")).join(","),
        },
        statut: 400,
      },
      400,
    );
  }
  return resultat.data;
}

@Controller("api/identite")
@ApiTags("identite")
export class IdentiteController {
  constructor(@Inject(IDENTITE_PORT) private readonly identite: PortIdentite) {}

  @Post("invites")
  @ApiOperation({ summary: "Créer un profil invité sans e-mail" })
  @ApiCreatedResponse({ description: "Profil invité et jeton d'accès." })
  creerInvite(@Body() corps: unknown) {
    const entree = parser(schemaInvite, corps);
    return this.identite.creerInvite(entree.langue);
  }

  @Post("inscription")
  @ApiOperation({ summary: "Créer un compte joueur" })
  @ApiCreatedResponse({ description: "Profil et jeton d'accès." })
  @ApiResponse({ status: 409, description: "Identifiant déjà utilisé." })
  inscrire(@Body() corps: unknown) {
    const entree = parser(schemaInscription, corps);
    return this.identite.inscrire({
      pseudo: entree.pseudo,
      motDePasse: entree.motDePasse,
      langue: entree.langue,
      ...(entree.courriel !== undefined ? { courriel: entree.courriel } : {}),
    });
  }

  @Post("connexion")
  @ApiOperation({ summary: "Ouvrir une session joueur" })
  @ApiCreatedResponse({ description: "Profil et jeton d'accès." })
  @ApiResponse({ status: 401, description: "Identifiant ou mot de passe invalide." })
  @ApiResponse({ status: 429, description: "Trop de tentatives de connexion." })
  connecter(@Body() corps: unknown, @Req() requete: RequeteAuthentifiee) {
    const entree = parser(schemaConnexion, corps);
    return this.identite.connecter({ ...entree, adresseIp: requete.ip });
  }

  @Get("profil")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Lire le profil associé au jeton" })
  @ApiOkResponse({ description: "Profil du joueur authentifié." })
  @SetMetadata(ROLES_KEY, ["joueur"])
  profil(@Req() requete: RequeteAuthentifiee) {
    if (requete.utilisateur === undefined) {
      throw new HttpException({ code: "AUTH_REQUISE", params: {}, statut: 401 }, 401);
    }
    return this.identite.lireProfil(requete.utilisateur.utilisateurId);
  }

  @Patch("profil/langue")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Modifier la langue du profil" })
  @ApiOkResponse({ description: "Profil actualisé." })
  @SetMetadata(ROLES_KEY, ["joueur"])
  definirLangue(@Body() corps: unknown, @Req() requete: RequeteAuthentifiee) {
    if (requete.utilisateur === undefined) {
      throw new HttpException({ code: "AUTH_REQUISE", params: {}, statut: 401 }, 401);
    }
    const entree = parser(schemaLangueProfil, corps);
    return this.identite.definirLangue(requete.utilisateur.utilisateurId, entree.langue);
  }
}
