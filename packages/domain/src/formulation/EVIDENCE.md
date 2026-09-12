# Material evidence

The library's use bands, maxima, solubility and notes are legacy guidance without
verified provenance. Presence in the guide does not establish scientific validity.

Curated evidence lives in evidence.ts. get_material_evidence searches it by material
identity, supplier or property keyword. Material search and the formulation guide
return provenance summaries; full passages are fetched only when needed.

## Adding a source

1. Read the original manufacturer document or authoritative publication.
2. Record the exact supplier product and supplied concentration (null if unknown).
   Do not assume a shared INCI establishes the same grade, composition or dilution.
3. Record title, original URL, revision (null if unpublished), access date and
   page/section locator. Store a short permitted excerpt, not an entire publication.
4. Add one narrowly scoped property statement with conditions and limitations.
   Numerical facts require a value, unit and concentration basis.
5. Check that the cited passage actually supports the statement. source_checked
   describes this check, not independent lab verification or expert approval.
6. Add a test when extending identity matching or numerical applicability.

Never turn a supplier's typical dose into a regulatory maximum. Do not overwrite
legacy material fields merely because a related evidence record exists. Conflicting
or outdated sources require review, not silent selection by the model.

The first record supports only the olfactive description of IFF Iso E Super.
Its use level is deliberately not imported: the source's concentration basis has
not been verified. Its presence does not validate the associated library record.

This initial implementation is a code-curated registry, not a document-upload,
PDF extraction or full-text database. Supplier document ingestion and expert
review workflows can extend the same record contract later. Unknown coverage
must stay visible in agent recommendations.
