import { Contact } from '../models/contact.model.js';

// Finds a contact by name, ignoring case.
export function findContact(name: string) {
  return Contact.findOne({ name: name.trim().toLowerCase() });
}

// Saves a contact, replacing the number if the name already exists.
export function saveContact(name: string, phone: string) {
  return Contact.findOneAndUpdate({ name: name.trim().toLowerCase() }, { phone }, { upsert: true, new: true });
}

// Finds a contact by its id.
export function findContactById(id: string) {
  return Contact.findById(id);
}
