import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  generateUserId, 
  DEFAULT_FOLDERS, 
  DEFAULT_DATASET_ITEMS, 
  exportAssessmentsToCSV, 
  exportAssessmentsToJSON,
  generateSupabaseSQLTable,
  verifyAdminCredentials,
  getUserDatasetSummaries
} from './assessmentStorage';
import { AssessmentRecord } from '../types/freshness';

test('generateUserId returns correct usr_ prefix and length', () => {
  const id1 = generateUserId();
  const id2 = generateUserId();
  assert.match(id1, /^usr_[a-z0-9]{7}$/);
  assert.match(id2, /^usr_[a-z0-9]{7}$/);
  assert.notEqual(id1, id2, 'User IDs should be unique');
});

test('default folders have FRESHNESS ASSESSMENT parent and 3 subfolders', () => {
  const parent = DEFAULT_FOLDERS.find((f) => f.isParent);
  assert.ok(parent, 'Should have a parent folder');
  assert.equal(parent.name, 'FRESHNESS ASSESSMENT');

  const subfolders = DEFAULT_FOLDERS.filter((f) => !f.isParent && f.parentId === parent.id);
  const subNames = subfolders.map((s) => s.name).sort();
  assert.deepEqual(subNames, ['fresh', 'semi-fresh', 'spoiled']);
});

test('default dataset items include items across all 3 classes', () => {
  const freshItems = DEFAULT_DATASET_ITEMS.filter((i) => i.subFolder === 'fresh');
  const semiItems = DEFAULT_DATASET_ITEMS.filter((i) => i.subFolder === 'semi-fresh');
  const spoilItems = DEFAULT_DATASET_ITEMS.filter((i) => i.subFolder === 'spoiled');

  assert.ok(freshItems.length >= 3, 'Should have multiple fresh items');
  assert.ok(semiItems.length >= 2, 'Should have multiple semi-fresh items');
  assert.ok(spoilItems.length >= 2, 'Should have multiple spoiled items');

  freshItems.forEach((item) => {
    assert.equal(item.parentFolder, 'FRESHNESS ASSESSMENT');
    assert.ok(item.imageUrl.startsWith('https://'), 'Item must have valid image URL');
  });
});

test('CSV export generates correct headers and escapes values', () => {
  const mockAssessments: AssessmentRecord[] = [
    {
      id: 'rec_01',
      user_id: 'usr_abc1234',
      image_id: 'img_fresh_01',
      image_name: 'Crisp Apple, "Gala"',
      image_url: 'https://example.com/apple.jpg',
      parent_folder: 'FRESHNESS ASSESSMENT',
      sub_folder: 'fresh',
      classification: 'fresh',
      assessed_at: '2026-10-27T00:00:00.000Z',
      notes: 'Firm peel, looks fresh',
    },
  ];

  const csv = exportAssessmentsToCSV(mockAssessments);
  assert.ok(csv.includes('id,user_id,image_id,image_name'));
  assert.ok(csv.includes('"usr_abc1234"'));
  assert.ok(csv.includes('"Crisp Apple, ""Gala"""'));
  assert.ok(csv.includes('"fresh"'));
});

test('verifyAdminCredentials validates leirad and Ganzon2003 correctly', () => {
  assert.equal(verifyAdminCredentials('leirad', 'Ganzon2003'), true);
  assert.equal(verifyAdminCredentials('leirad', 'wrongpass'), false);
  assert.equal(verifyAdminCredentials('admin', 'Ganzon2003'), false);
});

test('getUserDatasetSummaries groups and numbers users chronologically', () => {
  const mockData: AssessmentRecord[] = [
    {
      id: '1',
      user_id: 'usr_alpha',
      image_id: 'img1',
      image_name: 'Apple',
      image_url: '',
      parent_folder: 'P',
      sub_folder: 'fresh',
      classification: 'fresh',
      assessed_at: '2026-10-27T01:00:00Z',
    },
    {
      id: '2',
      user_id: 'usr_alpha',
      image_id: 'img2',
      image_name: 'Banana',
      image_url: '',
      parent_folder: 'P',
      sub_folder: 'spoiled',
      classification: 'spoiled',
      assessed_at: '2026-10-27T01:05:00Z',
    },
    {
      id: '3',
      user_id: 'usr_beta',
      image_id: 'img1',
      image_name: 'Apple',
      image_url: '',
      parent_folder: 'P',
      sub_folder: 'fresh',
      classification: 'semi-fresh',
      assessed_at: '2026-10-27T02:00:00Z',
    },
  ];

  const summaries = getUserDatasetSummaries(mockData, 2);
  assert.equal(summaries.length, 2);

  // User 1 is Evaluator 1
  assert.equal(summaries[0].evaluatorNumber, 1);
  assert.equal(summaries[0].userId, 'usr_alpha');
  assert.equal(summaries[0].totalAssessed, 2);
  assert.equal(summaries[0].freshRecords.length, 1);
  assert.equal(summaries[0].spoiledRecords.length, 1);
  assert.equal(summaries[0].isCompleted, true);

  // User 2 is Evaluator 2
  assert.equal(summaries[1].evaluatorNumber, 2);
  assert.equal(summaries[1].userId, 'usr_beta');
  assert.equal(summaries[1].totalAssessed, 1);
  assert.equal(summaries[1].semiFreshRecords.length, 1);
  assert.equal(summaries[1].isCompleted, false);
});

