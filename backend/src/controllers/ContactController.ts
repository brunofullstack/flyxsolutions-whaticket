import * as Yup from "yup";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import ListContactsService from "../services/ContactServices/ListContactsService";
import CreateContactService from "../services/ContactServices/CreateContactService";
import ShowContactService from "../services/ContactServices/ShowContactService";
import UpdateContactService from "../services/ContactServices/UpdateContactService";
import DeleteContactService from "../services/ContactServices/DeleteContactService";
import GetContactService from "../services/ContactServices/GetContactService";

import CheckContactNumber from "../services/WbotServices/CheckNumber";
import CheckIsValidContact from "../services/WbotServices/CheckIsValidContact";
import GetProfilePicUrl from "../services/WbotServices/GetProfilePicUrl";
import AppError from "../errors/AppError";
import SimpleListService, {
  SearchContactParams
} from "../services/ContactServices/SimpleListService";
import ContactCustomField from "../models/ContactCustomField";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
};

type IndexGetContactQuery = {
  name: string;
  number: string;
};

interface ExtraInfo extends ContactCustomField {
  name: string;
  value: string;
}
interface ContactData {
  name: string;
  number: string;
  email?: string;
  extraInfo?: ExtraInfo[];
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;
  const { companyId } = req.user;

  const { contacts, count, hasMore } = await ListContactsService({
    searchParam,
    pageNumber,
    companyId
  });

  return res.json({ contacts, count, hasMore });
};

export const getContact = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { name, number } = req.body as IndexGetContactQuery;
  const { companyId } = req.user;

  const contact = await GetContactService({
    name,
    number,
    companyId
  });

  return res.status(200).json(contact);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const newContact: ContactData = req.body;
  newContact.number = newContact.number.replace("-", "").replace(" ", "");

  const schema = Yup.object().shape({
    name: Yup.string().required(),
    number: Yup.string()
      .required()
      .matches(/^\d+$/, "Formato de número inválido.Apenas números são permitidos.")
  });

  try {
    await schema.validate(newContact);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await CheckIsValidContact(newContact.number, companyId);
  const validNumber = await CheckContactNumber(newContact.number, companyId);
  const number = validNumber.jid.replace(/\D/g, "");
  newContact.number = number;

  /**
   * Código desabilitado por demora no retorno
   */
  // const profilePicUrl = await GetProfilePicUrl(validNumber.jid, companyId);

  const contact = await CreateContactService({
    ...newContact,
    // profilePicUrl,
    companyId
  });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
    action: "create",
    contact
  });

  return res.status(200).json(contact);
};

// Trata da importação de tabelas excel e csv
export const storeCSV = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const contacts = req.body.contacts;  // Extrair o array de contatos do objeto recebido

  // Definir o esquema de validação para cada contato
  const schema = Yup.object().shape({
    name: Yup.string().required(),
    number: Yup.string()
      .required()
      .matches(/^\d+$/, "Formato de número inválido. Apenas números são permitidos."),
    email: Yup.string().email().optional()
  });

  try {
    // Validar e processar cada contato do array
    const createdContacts = [];
    for (const contact of contacts) {
      console.log("contact: ", contact);
      await schema.validate(contact);  // Validar os dados

      // Sanitizar o número de telefone
      contact.number = contact.number.toString().replace("-", "").replace(" ", "");  

      // Verificar se o número é válido
      await CheckIsValidContact(contact.number, companyId);

      // Criar o contato no banco, ignorando contatos duplicados
      const newContact = await CreateContactService({
        name: contact.name,
        number: contact.number,
        email: contact.email || "",  // Deixa o email vazio se não for fornecido
        profilePicUrl: "",  // Valor vazio para profilePicUrl
        companyId,
        extraInfo: []  // Valor vazio para extraInfo
      });

      if (newContact) {
        // Se o contato foi criado com sucesso, adicioná-lo à lista de contatos criados
        createdContacts.push(newContact);

        // Emitir evento para a empresa no canal principal
        const io = getIO();
        io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
          action: "create",
          contact: newContact
        });
      }
    }

    // Retornar a resposta com todos os contatos criados
    return res.status(200).json({ message: "Contatos importados com sucesso.", createdContacts });

  } catch (err: any) {
    console.error("Erro ao processar contatos CSV:", err);
    return res.status(400).json({ error: err.message });
  }
};




export const show = async (req: Request, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;

  const contact = await ShowContactService(contactId, companyId);

  return res.status(200).json(contact);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const contactData: ContactData = req.body;
  const { companyId } = req.user;

  const schema = Yup.object().shape({
    name: Yup.string(),
    number: Yup.string().matches(
      /^\d+$/,
      "Invalid number format. Only numbers is allowed."
    )
  });

  try {
    await schema.validate(contactData);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await CheckIsValidContact(contactData.number, companyId);
  const validNumber = await CheckContactNumber(contactData.number, companyId);
  const number = validNumber.jid.replace(/\D/g, "");
  contactData.number = number;

  const { contactId } = req.params;

  const contact = await UpdateContactService({
    contactData,
    contactId,
    companyId
  });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
    action: "update",
    contact
  });

  return res.status(200).json(contact);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;

  await ShowContactService(contactId, companyId);

  await DeleteContactService(contactId);

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
    action: "delete",
    contactId
  });

  return res.status(200).json({ message: "Contact deleted" });
};

export const list = async (req: Request, res: Response): Promise<Response> => {
  const { name } = req.query as unknown as SearchContactParams;
  const { companyId } = req.user;

  const contacts = await SimpleListService({ name, companyId });

  return res.json(contacts);
};